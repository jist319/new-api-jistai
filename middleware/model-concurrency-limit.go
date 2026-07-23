package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

const (
	modelRequestConcurrencyLeaseDuration    = 90 * time.Second
	modelRequestConcurrencyRenewInterval    = 30 * time.Second
	modelRequestConcurrencyOperationTimeout = 2 * time.Second
	modelRequestConcurrencyReleaseTimeout   = 2 * time.Second
	modelRequestConcurrencyRetryInitial     = time.Second
	modelRequestConcurrencyRetryMaximum     = 5 * time.Second
)

var (
	modelRequestConcurrencyAcquireScript = redis.NewScript(`
local redis_time = redis.call('TIME')
local now_ms = redis_time[1] * 1000 + math.floor(redis_time[2] / 1000)
local lease_ms = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now_ms)
if redis.call('ZSCORE', KEYS[1], ARGV[1]) then
  redis.call('ZADD', KEYS[1], now_ms + lease_ms, ARGV[1])
  redis.call('PEXPIRE', KEYS[1], lease_ms)
  return 1
end
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then
  redis.call('PEXPIRE', KEYS[1], lease_ms)
  return 0
end

redis.call('ZADD', KEYS[1], now_ms + lease_ms, ARGV[1])
redis.call('PEXPIRE', KEYS[1], lease_ms)
return 1
`)
	modelRequestConcurrencyRenewScript = redis.NewScript(`
local redis_time = redis.call('TIME')
local now_ms = redis_time[1] * 1000 + math.floor(redis_time[2] / 1000)
local lease_ms = tonumber(ARGV[2])
local score = redis.call('ZSCORE', KEYS[1], ARGV[1])

if not score then
  return 0
end
if tonumber(score) <= now_ms then
  redis.call('ZREM', KEYS[1], ARGV[1])
  return 0
end

redis.call('ZADD', KEYS[1], now_ms + lease_ms, ARGV[1])
redis.call('PEXPIRE', KEYS[1], lease_ms)
return 1
`)
	modelRequestConcurrencyReleaseScript = redis.NewScript(`
local removed = redis.call('ZREM', KEYS[1], ARGV[1])
if redis.call('ZCARD', KEYS[1]) == 0 then
  redis.call('DEL', KEYS[1])
end
return removed
`)
	modelRequestConcurrencyMemoryStore = newMemoryConcurrencyStore()
)

type modelRequestConcurrencyStore interface {
	Acquire(ctx context.Context, userID, leaseID string, limit int) (bool, error)
	Renew(ctx context.Context, userID, leaseID string) (bool, error)
	Release(ctx context.Context, userID, leaseID string) error
	RenewInterval() time.Duration
}

type redisConcurrencyStore struct {
	client        redis.Scripter
	leaseDuration time.Duration
	renewInterval time.Duration
}

func newRedisConcurrencyStore(client redis.Scripter, leaseDuration, renewInterval time.Duration) *redisConcurrencyStore {
	return &redisConcurrencyStore{
		client:        client,
		leaseDuration: leaseDuration,
		renewInterval: renewInterval,
	}
}

func (s *redisConcurrencyStore) Acquire(ctx context.Context, userID, leaseID string, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}
	if s.client == nil {
		return false, errors.New("redis client is unavailable")
	}

	result, err := modelRequestConcurrencyAcquireScript.Run(
		ctx,
		s.client,
		[]string{modelRequestConcurrencyRedisKey(userID)},
		leaseID,
		limit,
		s.leaseDuration.Milliseconds(),
	).Int64()
	if err != nil {
		return false, err
	}
	return result == 1, nil
}

func (s *redisConcurrencyStore) Renew(ctx context.Context, userID, leaseID string) (bool, error) {
	if s.client == nil {
		return false, errors.New("redis client is unavailable")
	}

	result, err := modelRequestConcurrencyRenewScript.Run(
		ctx,
		s.client,
		[]string{modelRequestConcurrencyRedisKey(userID)},
		leaseID,
		s.leaseDuration.Milliseconds(),
	).Int64()
	if err != nil {
		return false, err
	}
	return result == 1, nil
}

func (s *redisConcurrencyStore) Release(ctx context.Context, userID, leaseID string) error {
	if s.client == nil {
		return errors.New("redis client is unavailable")
	}

	return modelRequestConcurrencyReleaseScript.Run(
		ctx,
		s.client,
		[]string{modelRequestConcurrencyRedisKey(userID)},
		leaseID,
	).Err()
}

func (s *redisConcurrencyStore) RenewInterval() time.Duration {
	return s.renewInterval
}

func modelRequestConcurrencyRedisKey(userID string) string {
	return "new-api:model-concurrency:v1:{" + userID + "}"
}

type memoryConcurrencyStore struct {
	mutex  sync.Mutex
	leases map[string]map[string]struct{}
}

func newMemoryConcurrencyStore() *memoryConcurrencyStore {
	return &memoryConcurrencyStore{leases: make(map[string]map[string]struct{})}
}

func (s *memoryConcurrencyStore) Acquire(_ context.Context, userID, leaseID string, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	userLeases := s.leases[userID]
	if _, found := userLeases[leaseID]; found {
		return true, nil
	}
	if len(userLeases) >= limit {
		return false, nil
	}
	if userLeases == nil {
		userLeases = make(map[string]struct{})
		s.leases[userID] = userLeases
	}
	userLeases[leaseID] = struct{}{}
	return true, nil
}

func (s *memoryConcurrencyStore) Renew(_ context.Context, userID, leaseID string) (bool, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	_, found := s.leases[userID][leaseID]
	return found, nil
}

func (s *memoryConcurrencyStore) Release(_ context.Context, userID, leaseID string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	userLeases := s.leases[userID]
	delete(userLeases, leaseID)
	if len(userLeases) == 0 {
		delete(s.leases, userID)
	}
	return nil
}

func (s *memoryConcurrencyStore) RenewInterval() time.Duration {
	return 0
}

// ModelRequestConcurrencyLimit limits synchronous model relays. Async task,
// Midjourney, video, and playground routes intentionally retain their existing
// independent rate-control semantics.
func ModelRequestConcurrencyLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if common.RedisEnabled {
			var store modelRequestConcurrencyStore
			if common.RDB != nil {
				store = newRedisConcurrencyStore(
					common.RDB,
					modelRequestConcurrencyLeaseDuration,
					modelRequestConcurrencyRenewInterval,
				)
			}
			handleModelRequestConcurrencyLimit(c, store)
			return
		}

		handleModelRequestConcurrencyLimit(c, modelRequestConcurrencyMemoryStore)
	}
}

func modelRequestConcurrencyLimitWithStore(store modelRequestConcurrencyStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		handleModelRequestConcurrencyLimit(c, store)
	}
}

func handleModelRequestConcurrencyLimit(c *gin.Context, store modelRequestConcurrencyStore) {
	group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	if group == "" {
		group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	}
	limit := setting.GetModelRequestConcurrencyLimit(group)
	if limit <= 0 {
		c.Next()
		return
	}
	if store == nil || c.GetInt("id") <= 0 {
		abortConcurrencyLimiterUnavailable(c)
		return
	}

	userID := strconv.Itoa(c.GetInt("id"))
	leaseID := uuid.NewString()
	acquireCtx, cancelAcquire := context.WithTimeout(c.Request.Context(), modelRequestConcurrencyOperationTimeout)
	allowed, err := store.Acquire(acquireCtx, userID, leaseID, limit)
	cancelAcquire()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("model request concurrency lease acquire failed for user %s: %v", userID, err))
		releaseModelRequestConcurrencyLease(c.Request.Context(), store, userID, leaseID)
		abortConcurrencyLimiterUnavailable(c)
		return
	}
	if !allowed {
		c.Header("Retry-After", "1")
		abortWithOpenAiMessage(
			c,
			http.StatusTooManyRequests,
			"Too many concurrent requests. Please retry shortly.",
			types.ErrorCode("concurrency_limit_reached"),
		)
		return
	}

	logCtx := c.Request.Context()
	stopRenew, renewDone := startModelRequestConcurrencyRenewal(logCtx, store, userID, leaseID, limit)
	defer func() {
		stopRenew()
		<-renewDone
		releaseModelRequestConcurrencyLease(logCtx, store, userID, leaseID)
	}()

	c.Next()
}

func startModelRequestConcurrencyRenewal(
	logCtx context.Context,
	store modelRequestConcurrencyStore,
	userID string,
	leaseID string,
	limit int,
) (context.CancelFunc, <-chan struct{}) {
	return startModelRequestConcurrencyRenewalWithWait(
		logCtx,
		store,
		userID,
		leaseID,
		limit,
		waitForModelRequestConcurrencyRenewal,
	)
}

func startModelRequestConcurrencyRenewalWithWait(
	logCtx context.Context,
	store modelRequestConcurrencyStore,
	userID string,
	leaseID string,
	limit int,
	wait func(context.Context, time.Duration) bool,
) (context.CancelFunc, <-chan struct{}) {
	renewDone := make(chan struct{})
	if store.RenewInterval() <= 0 {
		close(renewDone)
		return func() {}, renewDone
	}

	// Keep renewing until c.Next returns, even if the client disconnects. Some
	// provider paths do not stop immediately on request cancellation; ending the
	// lease early would let another request exceed the configured concurrency.
	renewCtx, stopRenew := context.WithCancel(context.Background())
	go func() {
		defer close(renewDone)
		runModelRequestConcurrencyRenewal(renewCtx, logCtx, store, userID, leaseID, limit, wait)
	}()
	return stopRenew, renewDone
}

func runModelRequestConcurrencyRenewal(
	renewCtx context.Context,
	logCtx context.Context,
	store modelRequestConcurrencyStore,
	userID string,
	leaseID string,
	limit int,
	wait func(context.Context, time.Duration) bool,
) {
	delay := store.RenewInterval()
	failureCount := 0
	for wait(renewCtx, delay) {
		operationCtx, cancelOperation := context.WithTimeout(renewCtx, modelRequestConcurrencyOperationTimeout)
		maintained, err := maintainModelRequestConcurrencyLease(operationCtx, store, userID, leaseID, limit)
		cancelOperation()
		if renewCtx.Err() != nil {
			return
		}
		if err != nil || !maintained {
			failureCount++
			if err != nil {
				logger.LogError(logCtx, fmt.Sprintf("model request concurrency lease renewal failed for user %s: %v", userID, err))
			} else {
				logger.LogError(logCtx, fmt.Sprintf("model request concurrency lease could not be restored for user %s", userID))
			}
			delay = modelRequestConcurrencyRetryDelay(failureCount)
			continue
		}

		failureCount = 0
		delay = store.RenewInterval()
	}
}

func maintainModelRequestConcurrencyLease(
	ctx context.Context,
	store modelRequestConcurrencyStore,
	userID string,
	leaseID string,
	limit int,
) (bool, error) {
	renewed, err := store.Renew(ctx, userID, leaseID)
	if err != nil {
		return false, err
	}
	if renewed {
		return true, nil
	}

	reacquired, err := store.Acquire(ctx, userID, leaseID, limit)
	if err != nil {
		return false, fmt.Errorf("reacquire expired concurrency lease: %w", err)
	}
	return reacquired, nil
}

func modelRequestConcurrencyRetryDelay(failureCount int) time.Duration {
	delay := modelRequestConcurrencyRetryInitial
	for attempt := 1; attempt < failureCount && delay < modelRequestConcurrencyRetryMaximum; attempt++ {
		delay *= 2
	}
	if delay > modelRequestConcurrencyRetryMaximum {
		return modelRequestConcurrencyRetryMaximum
	}
	return delay
}

func waitForModelRequestConcurrencyRenewal(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func releaseModelRequestConcurrencyLease(
	logCtx context.Context,
	store modelRequestConcurrencyStore,
	userID string,
	leaseID string,
) {
	releaseCtx, cancelRelease := context.WithTimeout(context.Background(), modelRequestConcurrencyReleaseTimeout)
	defer cancelRelease()
	if err := store.Release(releaseCtx, userID, leaseID); err != nil {
		logger.LogWarn(logCtx, fmt.Sprintf("model request concurrency lease release failed for user %s: %v", userID, err))
	}
}

func abortConcurrencyLimiterUnavailable(c *gin.Context) {
	abortWithOpenAiMessage(
		c,
		http.StatusServiceUnavailable,
		"Concurrent request control is temporarily unavailable.",
		types.ErrorCode("concurrency_limiter_unavailable"),
	)
}
