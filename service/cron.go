package service

import (
	"EmptyClassroom/logs"
	"github.com/robfig/cron/v3"
)

var (
	GlobalCron *cron.Cron
)

func Cronjob() {
	ctx := logs.GenNewContext()
	_, err := QueryAll(ctx)
	if err != nil {
		logs.CtxError(ctx, "QueryAll error: %v", err)
	} else {
		logs.CtxInfo(ctx, "QueryAll success")
	}
}

func StartCron() {
	GlobalCron = cron.New()
	// 每天7点更新一次（教务系统也是每天更新）
	_, err := GlobalCron.AddFunc("0 7 * * *", Cronjob)
	if err != nil {
		logs.CtxError(nil, "GlobalCron.AddFunc error: %v", err)
		panic(err)
	}
	GlobalCron.Start()
	// 启动时立即异步执行一次
	go Cronjob()
}
