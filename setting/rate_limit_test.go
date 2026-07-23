package setting

import (
	"math"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateModelRequestRateLimitGroupKeepsPreviousValueOnError(t *testing.T) {
	original := ModelRequestRateLimitGroup2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateModelRequestRateLimitGroupByJSONString(original))
	})

	require.NoError(t, UpdateModelRequestRateLimitGroupByJSONString(`{"default":[10,8]}`))
	err := UpdateModelRequestRateLimitGroupByJSONString(`{"default":[-1,8]}`)

	require.Error(t, err)
	total, success, found := GetGroupRateLimit("default")
	assert.True(t, found)
	assert.Equal(t, 10, total)
	assert.Equal(t, 8, success)
}

func TestParseModelRequestConcurrencyLimitBoundaries(t *testing.T) {
	tests := []struct {
		name      string
		value     string
		expected  int
		wantError bool
	}{
		{name: "unlimited", value: "0", expected: 0},
		{name: "positive", value: "20", expected: 20},
		{name: "surrounding whitespace", value: " 5 ", expected: 5},
		{name: "maximum", value: "2147483647", expected: math.MaxInt32},
		{name: "negative", value: "-1", wantError: true},
		{name: "above maximum", value: "2147483648", wantError: true},
		{name: "fraction", value: "1.5", wantError: true},
		{name: "empty", value: "", wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual, err := ParseModelRequestConcurrencyLimit(test.value)
			if test.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.expected, actual)
		})
	}
}

func TestModelRequestConcurrencyLimitGroupSemanticsAndAtomicUpdate(t *testing.T) {
	originalLimit := GetModelRequestConcurrencyLimit("")
	originalGroups := ModelRequestConcurrencyLimitGroup2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateModelRequestConcurrencyLimitGroupByJSONString(originalGroups))
		require.NoError(t, UpdateModelRequestConcurrencyLimit(strconv.Itoa(originalLimit)))
	})

	require.NoError(t, UpdateModelRequestConcurrencyLimit("5"))
	require.NoError(t, UpdateModelRequestConcurrencyLimitGroupByJSONString(`{"vip":20,"unlimited":0}`))

	assert.Equal(t, 20, GetModelRequestConcurrencyLimit("vip"))
	assert.Equal(t, 0, GetModelRequestConcurrencyLimit("unlimited"))
	assert.Equal(t, 5, GetModelRequestConcurrencyLimit("missing"))
	assert.Equal(t, 5, GetModelRequestConcurrencyLimit(""))

	invalidValues := []string{
		`{"vip":-1}`,
		`{"vip":2147483648}`,
		`[]`,
		`null`,
		`{"vip":"20"}`,
		`{"":5}`,
		`{"   ":5}`,
	}
	for _, invalid := range invalidValues {
		require.Error(t, UpdateModelRequestConcurrencyLimitGroupByJSONString(invalid))
		assert.Equal(t, 20, GetModelRequestConcurrencyLimit("vip"))
		assert.Equal(t, 0, GetModelRequestConcurrencyLimit("unlimited"))
	}

	require.Error(t, UpdateModelRequestConcurrencyLimit("invalid"))
	assert.Equal(t, 5, GetModelRequestConcurrencyLimit("missing"))
}
