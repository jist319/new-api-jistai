package model

import (
	"errors"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestConcurrencyOptionHotUpdateRejectsInvalidValuesWithoutMutation(t *testing.T) {
	originalLimit := setting.GetModelRequestConcurrencyLimit("")
	originalGroups := setting.ModelRequestConcurrencyLimitGroup2JSONString()
	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateModelRequestConcurrencyLimit(strconv.Itoa(originalLimit)))
		require.NoError(t, setting.UpdateModelRequestConcurrencyLimitGroupByJSONString(originalGroups))
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	require.NoError(t, updateOptionMap("ModelRequestConcurrencyLimit", "5"))
	assert.Equal(t, 5, setting.GetModelRequestConcurrencyLimit("missing"))
	require.Error(t, updateOptionMap("ModelRequestConcurrencyLimit", "-1"))
	assert.Equal(t, 5, setting.GetModelRequestConcurrencyLimit("missing"))

	require.NoError(t, updateOptionMap("ModelRequestConcurrencyLimitGroup", `{"vip":20}`))
	assert.Equal(t, 20, setting.GetModelRequestConcurrencyLimit("vip"))
	require.Error(t, updateOptionMap("ModelRequestConcurrencyLimitGroup", `{"vip":-1}`))
	assert.Equal(t, 20, setting.GetModelRequestConcurrencyLimit("vip"))

	common.OptionMapRWMutex.RLock()
	assert.Equal(t, "5", common.OptionMap["ModelRequestConcurrencyLimit"])
	assert.Equal(t, `{"vip":20}`, common.OptionMap["ModelRequestConcurrencyLimitGroup"])
	common.OptionMapRWMutex.RUnlock()
}

func TestUpdateOptionDoesNotMutateRuntimeWhenPersistenceFails(t *testing.T) {
	originalDB := DB
	originalLimit := setting.GetModelRequestConcurrencyLimit("")
	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = map[string]string{"ModelRequestConcurrencyLimit": "3"}
	common.OptionMapRWMutex.Unlock()
	require.NoError(t, setting.UpdateModelRequestConcurrencyLimit("3"))
	t.Cleanup(func() {
		DB = originalDB
		require.NoError(t, setting.UpdateModelRequestConcurrencyLimit(strconv.Itoa(originalLimit)))
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	t.Run("first or create failure", func(t *testing.T) {
		database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		require.NoError(t, err)
		sqlDB, err := database.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
		DB = database

		require.Error(t, UpdateOption("ModelRequestConcurrencyLimit", "5"))
		assert.Equal(t, 3, setting.GetModelRequestConcurrencyLimit(""))
		common.OptionMapRWMutex.RLock()
		assert.Equal(t, "3", common.OptionMap["ModelRequestConcurrencyLimit"])
		common.OptionMapRWMutex.RUnlock()
	})

	t.Run("save failure", func(t *testing.T) {
		database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		require.NoError(t, err)
		require.NoError(t, database.AutoMigrate(&Option{}))
		require.NoError(t, database.Create(&Option{Key: "ModelRequestConcurrencyLimit", Value: "3"}).Error)
		require.NoError(t, database.Callback().Update().Before("gorm:update").Register("test:fail-update", func(tx *gorm.DB) {
			tx.AddError(errors.New("forced update failure"))
		}))
		DB = database

		require.Error(t, UpdateOption("ModelRequestConcurrencyLimit", "5"))
		assert.Equal(t, 3, setting.GetModelRequestConcurrencyLimit(""))
		common.OptionMapRWMutex.RLock()
		assert.Equal(t, "3", common.OptionMap["ModelRequestConcurrencyLimit"])
		common.OptionMapRWMutex.RUnlock()
		var persisted Option
		require.NoError(t, database.First(&persisted, "key = ?", "ModelRequestConcurrencyLimit").Error)
		assert.Equal(t, "3", persisted.Value)
	})
}
