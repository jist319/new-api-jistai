package setting

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var ModelRequestRateLimitEnabled = false
var ModelRequestRateLimitDurationMinutes = 1
var ModelRequestRateLimitCount = 0
var ModelRequestRateLimitSuccessCount = 1000
var ModelRequestRateLimitGroup = map[string][2]int{}
var ModelRequestRateLimitMutex sync.RWMutex

var ModelRequestConcurrencyLimit = 0
var ModelRequestConcurrencyLimitGroup = map[string]int{}
var ModelRequestConcurrencyLimitMutex sync.RWMutex

func ModelRequestRateLimitGroup2JSONString() string {
	ModelRequestRateLimitMutex.RLock()
	defer ModelRequestRateLimitMutex.RUnlock()

	jsonBytes, err := common.Marshal(ModelRequestRateLimitGroup)
	if err != nil {
		common.SysLog("error marshalling model request rate limit group: " + err.Error())
		return "{}"
	}
	return string(jsonBytes)
}

func UpdateModelRequestRateLimitGroupByJSONString(jsonStr string) error {
	groupLimits, err := parseModelRequestRateLimitGroup(jsonStr)
	if err != nil {
		return err
	}

	ModelRequestRateLimitMutex.Lock()
	ModelRequestRateLimitGroup = groupLimits
	ModelRequestRateLimitMutex.Unlock()
	return nil
}

func GetGroupRateLimit(group string) (totalCount, successCount int, found bool) {
	ModelRequestRateLimitMutex.RLock()
	defer ModelRequestRateLimitMutex.RUnlock()

	if ModelRequestRateLimitGroup == nil {
		return 0, 0, false
	}

	limits, found := ModelRequestRateLimitGroup[group]
	if !found {
		return 0, 0, false
	}
	return limits[0], limits[1], true
}

func CheckModelRequestRateLimitGroup(jsonStr string) error {
	_, err := parseModelRequestRateLimitGroup(jsonStr)
	return err
}

func parseModelRequestRateLimitGroup(jsonStr string) (map[string][2]int, error) {
	checkModelRequestRateLimitGroup := make(map[string][2]int)
	err := common.UnmarshalJsonStr(jsonStr, &checkModelRequestRateLimitGroup)
	if err != nil {
		return nil, err
	}
	if checkModelRequestRateLimitGroup == nil {
		return nil, fmt.Errorf("model request rate limit group must be a JSON object")
	}
	for group, limits := range checkModelRequestRateLimitGroup {
		if limits[0] < 0 || limits[1] < 1 {
			return nil, fmt.Errorf("group %s has invalid rate limit values: [%d, %d]", group, limits[0], limits[1])
		}
		if limits[0] > math.MaxInt32 || limits[1] > math.MaxInt32 {
			return nil, fmt.Errorf("group %s [%d, %d] has max rate limits value 2147483647", group, limits[0], limits[1])
		}
	}

	return checkModelRequestRateLimitGroup, nil
}

func ModelRequestConcurrencyLimitGroup2JSONString() string {
	ModelRequestConcurrencyLimitMutex.RLock()
	defer ModelRequestConcurrencyLimitMutex.RUnlock()

	jsonBytes, err := common.Marshal(ModelRequestConcurrencyLimitGroup)
	if err != nil {
		common.SysLog("error marshalling model request concurrency limit group: " + err.Error())
		return "{}"
	}
	return string(jsonBytes)
}

func ParseModelRequestConcurrencyLimit(value string) (int, error) {
	limit, err := strconv.ParseInt(strings.TrimSpace(value), 10, 32)
	if err != nil {
		return 0, fmt.Errorf("model request concurrency limit must be an integer between 0 and %d", math.MaxInt32)
	}
	if limit < 0 {
		return 0, fmt.Errorf("model request concurrency limit must be an integer between 0 and %d", math.MaxInt32)
	}
	return int(limit), nil
}

func UpdateModelRequestConcurrencyLimit(value string) error {
	limit, err := ParseModelRequestConcurrencyLimit(value)
	if err != nil {
		return err
	}

	ModelRequestConcurrencyLimitMutex.Lock()
	ModelRequestConcurrencyLimit = limit
	ModelRequestConcurrencyLimitMutex.Unlock()
	return nil
}

func CheckModelRequestConcurrencyLimitGroup(jsonStr string) error {
	_, err := parseModelRequestConcurrencyLimitGroup(jsonStr)
	return err
}

func UpdateModelRequestConcurrencyLimitGroupByJSONString(jsonStr string) error {
	groupLimits, err := parseModelRequestConcurrencyLimitGroup(jsonStr)
	if err != nil {
		return err
	}

	ModelRequestConcurrencyLimitMutex.Lock()
	ModelRequestConcurrencyLimitGroup = groupLimits
	ModelRequestConcurrencyLimitMutex.Unlock()
	return nil
}

func GetModelRequestConcurrencyLimit(group string) int {
	ModelRequestConcurrencyLimitMutex.RLock()
	defer ModelRequestConcurrencyLimitMutex.RUnlock()

	if group != "" {
		if limit, found := ModelRequestConcurrencyLimitGroup[group]; found {
			return limit
		}
	}
	return ModelRequestConcurrencyLimit
}

func parseModelRequestConcurrencyLimitGroup(jsonStr string) (map[string]int, error) {
	groupLimits := make(map[string]int)
	if err := common.UnmarshalJsonStr(jsonStr, &groupLimits); err != nil {
		return nil, err
	}
	if groupLimits == nil {
		return nil, fmt.Errorf("model request concurrency limit group must be a JSON object")
	}
	for group, limit := range groupLimits {
		if strings.TrimSpace(group) == "" {
			return nil, fmt.Errorf("model request concurrency limit group name must not be empty")
		}
		if limit < 0 || limit > math.MaxInt32 {
			return nil, fmt.Errorf("group %s concurrency limit must be between 0 and %d", group, math.MaxInt32)
		}
	}
	return groupLimits, nil
}
