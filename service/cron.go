package service

import (
	"EmptyClassroom/logs"
	"github.com/robfig/cron/v3"
	"math/rand"
	"sync"
	"time"
)

var (
	GlobalCron *cron.Cron
	queryMu    sync.Mutex
)

// Cronjob 尝试拉取数据，失败则间隔 60-120 秒重试直到成功。
// 使用 TryLock 防止并发重复拉取。
func Cronjob() {
	ctx := logs.GenNewContext()

	if !queryMu.TryLock() {
		logs.CtxInfo(ctx, "QueryAll already in progress, skipping")
		return
	}
	defer queryMu.Unlock()

	for {
		_, err := QueryAll(ctx)
		if err != nil {
			interval := time.Duration(60+rand.Intn(60)) * time.Second
			logs.CtxError(ctx, "QueryAll error: %v, will retry in %v", err, interval)
			time.Sleep(interval)
			ctx = logs.GenNewContext()
			continue
		}
		logs.CtxInfo(ctx, "QueryAll success")
		return
	}
}

func StartCron() {
	GlobalCron = cron.New()
	// 每天凌晨1点更新（教务系统0点更新数据）
	_, err := GlobalCron.AddFunc("0 1 * * *", Cronjob)
	if err != nil {
		logs.CtxError(nil, "GlobalCron.AddFunc error: %v", err)
		panic(err)
	}
	GlobalCron.Start()
	// 启动时立即异步执行一次（带重试）
	go Cronjob()
}
