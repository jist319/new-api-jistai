package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfiguredHealthURL(t *testing.T) {
	tests := []struct {
		name            string
		port            string
		healthcheckPort string
		want            string
		wantError       bool
	}{
		{name: "default", want: "http://127.0.0.1:3000/api/status"},
		{name: "application port", port: "8080", want: "http://127.0.0.1:8080/api/status"},
		{name: "healthcheck override", port: "8080", healthcheckPort: "9090", want: "http://127.0.0.1:9090/api/status"},
		{name: "non numeric", port: "invalid", wantError: true},
		{name: "zero", port: "0", wantError: true},
		{name: "out of range", port: "65536", wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("PORT", test.port)
			t.Setenv("HEALTHCHECK_PORT", test.healthcheckPort)

			got, err := configuredHealthURL()
			if test.wantError {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, test.want, got)
		})
	}
}
