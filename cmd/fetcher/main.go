package main

import (
	"EmptyClassroom/cache"
	"EmptyClassroom/config"
	"EmptyClassroom/logs"
	"EmptyClassroom/service"
	"EmptyClassroom/service/model"
	"context"
	"encoding/gob"
	"encoding/json"
	"os"
	"path/filepath"
)

// 独立的数据抓取器，供 GitHub Actions 使用
// 用法: go run cmd/fetcher/main.go
// 输出: frontend/public/data.json
func main() {
	gob.Register(&model.ClassInfo{})
	logs.Init(false)
	config.InitConfig()
	cache.InitCache()

	ctx := context.Background()
	logs.CtxInfo(ctx, "Fetcher: starting data refresh...")

	classInfo, err := service.QueryAll(ctx)
	if err != nil {
		logs.CtxError(ctx, "Fetcher: query failed: %v", err)
		os.Exit(1)
	}

	// 输出为前端可用格式
	output := map[string]interface{}{
		"code": 0,
		"data": classInfo,
	}

	jsonBytes, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		logs.CtxError(ctx, "Fetcher: json marshal failed: %v", err)
		os.Exit(1)
	}

	// 写入 frontend/public/data.json（Vite 会复制到 dist）
	outPath := filepath.Join("frontend", "public", "data.json")
	err = os.WriteFile(outPath, jsonBytes, 0644)
	if err != nil {
		logs.CtxError(ctx, "Fetcher: write file failed: %v", err)
		os.Exit(1)
	}

	logs.CtxInfo(ctx, "Fetcher: data saved to %s (%d bytes)", outPath, len(jsonBytes))
}
