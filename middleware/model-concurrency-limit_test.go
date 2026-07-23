package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubConcurrencyStore struct {
	acquireAllowed bool
	acquireErr     error
	releaseErr     error
	renewInterval  time.Duration
	releaseCalls   int
	releaseCtxErr  error
}

type recoveryConcurrencyStore struct {
	renewCalls int
	events     chan string
}

func (s *recoveryConcurrencyStore) Acquire(context.Context, string, string, int) (bool, error) {
	s.events <- "reacquire"
	return true, nil
}

func (s *recoveryConcurrencyStore) Renew(context.Context, string, string) (bool, error) {
	s.renewCalls++
	switch s.renewCalls {
	case 1:
		s.events <- "renew-error"
		return false, errors.New("transient redis error")
	case 2:
		s.events <- "renew-missing"
		return false, nil
	default:
		s.events <- "renew-ok"
		return true, nil
	}
}

func (s *recoveryConcurrencyStore) Release(context.Context, string, string) error {
	return nil
}

func (s *recoveryConcurrencyStore) RenewInterval() time.Duration {
	return 30 * time.Second
}

func (s *stubConcurrencyStore) Acquire(context.Context, string, string, int) (bool, error) {
	return s.acquireAllowed, s.acquireErr
}

func (s *stubConcurrencyStore) Renew(context.Context, string, string) (bool, error) {
	return true, nil
}

func (s *stubConcurrencyStore) Release(ctx context.Context, _, _ string) error {
	s.releaseCalls++
	s.releaseCtxErr = ctx.Err()
	return s.releaseErr
}

func (s *stubConcurrencyStore) RenewInterval() time.Duration {
	return s.renewInterval
}

func TestMemoryConcurrencyStoreLimitAndUserIsolation(t *testing.T) {
	store := newMemoryConcurrencyStore()
	ctx := context.Background()

	allowed, err := store.Acquire(ctx, "user-a", "lease-a1", 2)
	require.NoError(t, err)
	assert.True(t, allowed)
	allowed, err = store.Acquire(ctx, "user-a", "lease-a2", 2)
	require.NoError(t, err)
	assert.True(t, allowed)
	allowed, err = store.Acquire(ctx, "user-a", "lease-a3", 2)
	require.NoError(t, err)
	assert.False(t, allowed)

	allowed, err = store.Acquire(ctx, "user-b", "lease-b1", 2)
	require.NoError(t, err)
	assert.True(t, allowed)

	require.NoError(t, store.Release(ctx, "user-a", "lease-a1"))
	allowed, err = store.Acquire(ctx, "user-a", "lease-a3", 2)
	require.NoError(t, err)
	assert.True(t, allowed)
}

func TestMemoryConcurrencyStoreAcquireIsIdempotent(t *testing.T) {
	store := newMemoryConcurrencyStore()
	ctx := context.Background()

	allowed, err := store.Acquire(ctx, "idempotent-user", "lease-a", 1)
	require.NoError(t, err)
	assert.True(t, allowed)
	allowed, err = store.Acquire(ctx, "idempotent-user", "lease-a", 1)
	require.NoError(t, err)
	assert.True(t, allowed)
	allowed, err = store.Acquire(ctx, "idempotent-user", "lease-b", 1)
	require.NoError(t, err)
	assert.False(t, allowed)
}

func TestRedisConcurrencyStoreAtomicLimit(t *testing.T) {
	store, _, _ := newRedisConcurrencyTestStore(t, 90*time.Second)
	const limit = 3
	const requestCount = limit + 1
	start := make(chan struct{})
	results := make(chan bool, requestCount)
	errorsFound := make(chan error, requestCount)
	var waitGroup sync.WaitGroup

	for index := 0; index < requestCount; index++ {
		waitGroup.Add(1)
		go func(leaseID string) {
			defer waitGroup.Done()
			<-start
			allowed, err := store.Acquire(context.Background(), "atomic-user", leaseID, limit)
			results <- allowed
			errorsFound <- err
		}("lease-" + strconv.Itoa(index))
	}
	close(start)
	waitGroup.Wait()
	close(results)
	close(errorsFound)

	allowedCount := 0
	for allowed := range results {
		if allowed {
			allowedCount++
		}
	}
	for err := range errorsFound {
		require.NoError(t, err)
	}
	assert.Equal(t, limit, allowedCount)
}

func TestRedisConcurrencyStoreReleaseOnlyOwnLease(t *testing.T) {
	store, _, _ := newRedisConcurrencyTestStore(t, 90*time.Second)
	ctx := context.Background()

	allowed, err := store.Acquire(ctx, "release-user", "lease-a", 2)
	require.NoError(t, err)
	assert.True(t, allowed)
	allowed, err = store.Acquire(ctx, "release-user", "lease-b", 2)
	require.NoError(t, err)
	assert.True(t, allowed)

	require.NoError(t, store.Release(ctx, "release-user", "lease-a"))
	allowed, err = store.Acquire(ctx, "release-user", "lease-c", 2)
	require.NoError(t, err)
	assert.True(t, allowed)

	require.NoError(t, store.Release(ctx, "release-user", "lease-a"))
	allowed, err = store.Acquire(ctx, "release-user", "lease-d", 2)
	require.NoError(t, err)
	assert.False(t, allowed)
}

func TestRedisConcurrencyStoreAcquireIsIdempotent(t *testing.T) {
	store, _, _ := newRedisConcurrencyTestStore(t, 90*time.Second)
	ctx := context.Background()

	allowed, err := store.Acquire(ctx, "idempotent-user", "lease-a", 1)
	require.NoError(t, err)
	assert.True(t, allowed)
	allowed, err = store.Acquire(ctx, "idempotent-user", "lease-a", 1)
	require.NoError(t, err)
	assert.True(t, allowed)
	allowed, err = store.Acquire(ctx, "idempotent-user", "lease-b", 1)
	require.NoError(t, err)
	assert.False(t, allowed)
}

func TestRedisConcurrencyStoreLeaseRecoveryAndRenewal(t *testing.T) {
	store, server, _ := newRedisConcurrencyTestStore(t, 90*time.Second)
	ctx := context.Background()
	baseTime := time.Unix(1_700_000_000, 0)
	server.SetTime(baseTime)

	allowed, err := store.Acquire(ctx, "renew-user", "lease-a", 1)
	require.NoError(t, err)
	assert.True(t, allowed)

	server.SetTime(baseTime.Add(60 * time.Second))
	renewed, err := store.Renew(ctx, "renew-user", "lease-a")
	require.NoError(t, err)
	assert.True(t, renewed)

	server.SetTime(baseTime.Add(100 * time.Second))
	allowed, err = store.Acquire(ctx, "renew-user", "lease-b", 1)
	require.NoError(t, err)
	assert.False(t, allowed)

	server.SetTime(baseTime.Add(151 * time.Second))
	allowed, err = store.Acquire(ctx, "renew-user", "lease-b", 1)
	require.NoError(t, err)
	assert.True(t, allowed)

	server.SetTime(baseTime.Add(242 * time.Second))
	renewed, err = store.Renew(ctx, "renew-user", "lease-b")
	require.NoError(t, err)
	assert.False(t, renewed)
}

func TestModelRequestConcurrencyRenewalSurvivesRequestCancellationAndTransientFailure(t *testing.T) {
	store := &recoveryConcurrencyStore{events: make(chan string)}
	wakeRenewal := make(chan struct{})
	observedDelays := make(chan time.Duration, 4)
	wait := func(ctx context.Context, delay time.Duration) bool {
		observedDelays <- delay
		select {
		case <-ctx.Done():
			return false
		case <-wakeRenewal:
			return true
		}
	}
	requestContext, cancelRequest := context.WithCancel(context.Background())
	stopRenew, renewDone := startModelRequestConcurrencyRenewalWithWait(
		requestContext,
		store,
		"42",
		"lease-a",
		1,
		wait,
	)
	t.Cleanup(func() {
		stopRenew()
		<-renewDone
	})

	assert.Equal(t, 30*time.Second, <-observedDelays)
	cancelRequest()
	wakeRenewal <- struct{}{}
	assert.Equal(t, "renew-error", <-store.events)
	assert.Equal(t, time.Second, <-observedDelays)

	wakeRenewal <- struct{}{}
	assert.Equal(t, "renew-missing", <-store.events)
	assert.Equal(t, "reacquire", <-store.events)
	assert.Equal(t, 30*time.Second, <-observedDelays)

	wakeRenewal <- struct{}{}
	assert.Equal(t, "renew-ok", <-store.events)
}

func TestModelRequestConcurrencyLimitReturnsOpenAI429WithoutCallingDownstream(t *testing.T) {
	configureConcurrencyLimits(t, 1, `{}`)
	store := newMemoryConcurrencyStore()
	allowed, err := store.Acquire(context.Background(), "42", "occupied", 1)
	require.NoError(t, err)
	require.True(t, allowed)
	downstreamCalls := 0
	router := newConcurrencyTestRouter(store, func(c *gin.Context) {
		downstreamCalls++
		c.Status(http.StatusNoContent)
	})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/relay", nil))

	assert.Equal(t, http.StatusTooManyRequests, response.Code)
	assert.Equal(t, "1", response.Header().Get("Retry-After"))
	assert.Equal(t, 0, downstreamCalls)
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, "concurrency_limit_reached", body.Error.Code)
}

func TestModelRequestConcurrencyLimitFailsClosedOnStoreError(t *testing.T) {
	configureConcurrencyLimits(t, 1, `{}`)
	store := &stubConcurrencyStore{acquireErr: errors.New("redis unavailable")}
	downstreamCalls := 0
	router := newConcurrencyTestRouter(store, func(c *gin.Context) {
		downstreamCalls++
		c.Status(http.StatusNoContent)
	})

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/relay", nil))

	assert.Equal(t, http.StatusServiceUnavailable, response.Code)
	assert.Equal(t, 0, downstreamCalls)
	assert.Equal(t, 1, store.releaseCalls)
	assert.NoError(t, store.releaseCtxErr)
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, "concurrency_limiter_unavailable", body.Error.Code)
}

func TestModelRequestConcurrencyLimitHoldsLeaseUntilHandlerReturns(t *testing.T) {
	configureConcurrencyLimits(t, 1, `{}`)
	store := newMemoryConcurrencyStore()
	firstEntered := make(chan struct{})
	allowFirstToReturn := make(chan struct{})
	firstDone := make(chan *httptest.ResponseRecorder, 1)
	var downstreamCalls atomic.Int32
	router := newConcurrencyTestRouter(store, func(c *gin.Context) {
		if downstreamCalls.Add(1) == 1 {
			close(firstEntered)
			<-allowFirstToReturn
		}
		c.Status(http.StatusNoContent)
	})

	go func() {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/relay", nil))
		firstDone <- response
	}()
	<-firstEntered

	secondResponse := httptest.NewRecorder()
	router.ServeHTTP(secondResponse, httptest.NewRequest(http.MethodPost, "/relay", nil))
	assert.Equal(t, http.StatusTooManyRequests, secondResponse.Code)

	close(allowFirstToReturn)
	assert.Equal(t, http.StatusNoContent, (<-firstDone).Code)

	thirdResponse := httptest.NewRecorder()
	router.ServeHTTP(thirdResponse, httptest.NewRequest(http.MethodPost, "/relay", nil))
	assert.Equal(t, http.StatusNoContent, thirdResponse.Code)
	assert.Equal(t, int32(2), downstreamCalls.Load())
}

func TestModelRequestConcurrencyLimitGroupSelection(t *testing.T) {
	configureConcurrencyLimits(t, 1, `{"vip":2,"unlimited":0}`)
	store := newMemoryConcurrencyStore()
	for _, leaseID := range []string{"occupied-a", "occupied-b"} {
		allowed, err := store.Acquire(context.Background(), "42", leaseID, 2)
		require.NoError(t, err)
		require.True(t, allowed)
	}
	downstreamCalls := 0
	router := newConcurrencyTestRouter(store, func(c *gin.Context) {
		downstreamCalls++
		c.Status(http.StatusNoContent)
	})

	tokenPriority := httptest.NewRequest(http.MethodPost, "/relay", nil)
	tokenPriority.Header.Set("X-Test-Token-Group", "vip")
	tokenPriority.Header.Set("X-Test-User-Group", "unlimited")
	tokenPriorityResponse := httptest.NewRecorder()
	router.ServeHTTP(tokenPriorityResponse, tokenPriority)
	assert.Equal(t, http.StatusTooManyRequests, tokenPriorityResponse.Code)

	userFallback := httptest.NewRequest(http.MethodPost, "/relay", nil)
	userFallback.Header.Set("X-Test-User-Group", "unlimited")
	userFallbackResponse := httptest.NewRecorder()
	router.ServeHTTP(userFallbackResponse, userFallback)
	assert.Equal(t, http.StatusNoContent, userFallbackResponse.Code)

	missingTokenGroup := httptest.NewRequest(http.MethodPost, "/relay", nil)
	missingTokenGroup.Header.Set("X-Test-Token-Group", "missing")
	missingTokenGroup.Header.Set("X-Test-User-Group", "unlimited")
	missingTokenGroupResponse := httptest.NewRecorder()
	router.ServeHTTP(missingTokenGroupResponse, missingTokenGroup)
	assert.Equal(t, http.StatusTooManyRequests, missingTokenGroupResponse.Code)
	assert.Equal(t, 1, downstreamCalls)
}

func newRedisConcurrencyTestStore(
	t *testing.T,
	leaseDuration time.Duration,
) (*redisConcurrencyStore, *miniredis.Miniredis, *redis.Client) {
	t.Helper()
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		require.NoError(t, client.Close())
	})
	return newRedisConcurrencyStore(client, leaseDuration, 30*time.Second), server, client
}

func configureConcurrencyLimits(t *testing.T, limit int, groups string) {
	t.Helper()
	originalLimit := setting.GetModelRequestConcurrencyLimit("")
	originalGroups := setting.ModelRequestConcurrencyLimitGroup2JSONString()
	require.NoError(t, setting.UpdateModelRequestConcurrencyLimit(strconv.Itoa(limit)))
	require.NoError(t, setting.UpdateModelRequestConcurrencyLimitGroupByJSONString(groups))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateModelRequestConcurrencyLimit(strconv.Itoa(originalLimit)))
		require.NoError(t, setting.UpdateModelRequestConcurrencyLimitGroupByJSONString(originalGroups))
	})
}

func newConcurrencyTestRouter(store modelRequestConcurrencyStore, handler gin.HandlerFunc) *gin.Engine {
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("id", 42)
		common.SetContextKey(c, constant.ContextKeyTokenGroup, c.GetHeader("X-Test-Token-Group"))
		common.SetContextKey(c, constant.ContextKeyUserGroup, c.GetHeader("X-Test-User-Group"))
		c.Next()
	})
	router.Use(modelRequestConcurrencyLimitWithStore(store))
	router.POST("/relay", handler)
	return router
}
