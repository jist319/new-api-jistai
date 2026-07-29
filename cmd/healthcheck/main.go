package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"
)

const (
	defaultPort      = "3000"
	maxResponseBytes = 1 << 20
)

func main() {
	targetURL, err := configuredHealthURL()
	if err != nil {
		fail(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		fail(err)
	}

	client := &http.Client{
		Transport: &http.Transport{
			DisableKeepAlives: true,
			Proxy:             nil,
		},
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	response, err := client.Do(request)
	if err != nil {
		fail(err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		fail(err)
	}
	if response.StatusCode != http.StatusOK || !bytes.Contains(body, []byte(`"success":true`)) {
		fail(fmt.Errorf("unexpected health response: status=%d", response.StatusCode))
	}
}

func configuredHealthURL() (string, error) {
	port := os.Getenv("HEALTHCHECK_PORT")
	if port == "" {
		port = os.Getenv("PORT")
	}
	if port == "" {
		port = defaultPort
	}

	parsedPort, err := strconv.ParseUint(port, 10, 16)
	if err != nil || parsedPort == 0 {
		return "", fmt.Errorf("invalid healthcheck port %q", port)
	}
	return fmt.Sprintf("http://127.0.0.1:%d/api/status", parsedPort), nil
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
