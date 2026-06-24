package jobs

import (
	"context"
	"errors"
	"time"
)

type Queue struct {
	name    string
	timeout time.Duration
}

func (q Queue) Dispatch(ctx context.Context, payload []byte) error {
	// TODO #1: Validate payload schema before enqueueing
	if len(payload) == 0 {
		return errors.New("payload is empty")
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(q.timeout):
		return errors.New("dispatch timeout")
	default:
		// TODO #2: Replace in-memory dispatch with durable queue
		return nil
	}
}

func (q Queue) Name() string {
	// TODO #3: Normalize queue names during configuration load
	return q.name
}
