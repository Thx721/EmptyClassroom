package service

import (
	"EmptyClassroom/cache"
	"EmptyClassroom/config"
	"EmptyClassroom/logs"
	"EmptyClassroom/service/model"
	"EmptyClassroom/utils"
	"context"
	"encoding/json"
	"errors"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	LoginUrl = "http://jwglweixin.bupt.edu.cn/bjyddx/login"
	QueryUrl = "http://jwglweixin.bupt.edu.cn/bjyddx/todayClassrooms?campusId=0"

	LoginUsernameKey = "JW_USERNAME"
	LoginPasswordKey = "JW_PASSWORD"

	TodayCacheKey = "TODAY_CACHE"
)

var (
	Token string
)

func Login(ctx context.Context) error {
	userNo := os.Getenv(LoginUsernameKey)
	pwd := os.Getenv(LoginPasswordKey)
	req := map[string]string{
		"userNo":      userNo,
		"pwd":         utils.EncryptPassword(pwd),
		"encode":      "1",
		"captchaData": "",
		"codeVal":     "",
	}
	code, _, body, err := utils.HttpPostForm(ctx, LoginUrl, req)
	if err != nil {
		logs.CtxError(ctx, "login failed: %v", err)
		return err
	}
	if code != 200 {
		logs.CtxError(ctx, "login failed - code not 200: %v", err)
		return errors.New("login failed")
	}
	var resp model.LoginResponse
	err = json.Unmarshal(body, &resp)
	if err != nil {
		logs.CtxError(ctx, "login failed - resp unmarshal failed: %v", err)
		return err
	}
	if resp.Code != "1" {
		logs.CtxError(ctx, "login failed - code not 1: %v", err)
		return errors.New("login failed")
	}
	Token = resp.Data.Token
	return nil
}

func QueryOne(ctx context.Context, id int) ([]model.JWClassInfo, error) {
	errorTime := 0
	err := Login(ctx)
	// 重试3次
	for err != nil && errorTime < 3 {
		time.Sleep(10 * time.Second)
		err = Login(ctx)
		errorTime++
	}
	if err != nil {
		logs.CtxError(ctx, "login failed: %v", err)
	}
	if err == nil && errorTime > 0 {
		logs.CtxWarn(ctx, "login retry success, error time: %v", errorTime)
	}
	header := map[string]string{
		"token": Token,
	}
	code, _, body, err := utils.HttpGetWithHeader(ctx, QueryUrl+strconv.FormatInt(int64(id), 10), header)
	if err != nil {
		logs.CtxError(ctx, "query failed: %v", err)
		return nil, err
	}
	if code != 200 {
		logs.CtxError(ctx, "query failed - code not 200: %v", err)
		return nil, errors.New("query failed")
	}
	var resp model.QueryResponse
	err = json.Unmarshal(body, &resp)
	if err != nil {
		logs.CtxError(ctx, "query failed - resp unmarshal failed: %v", err)
		return nil, err
	}
	if resp.Code != "1" {
		logs.CtxError(ctx, "query failed - code not 1: %v", err)
		return nil, errors.New("query failed")
	}
	return resp.Data, nil
}

func QueryAll(ctx context.Context) (classInfo *model.ClassInfo, err error) {
	classInfo = &model.ClassInfo{
		UpdateAt:   time.Now(),
		IsFallback: map[string]bool{},
	}
	sysConfig := config.GetConfig()
	hasRealtime := false
	allRealtimeFailed := true
	for _, campus := range sysConfig.Campus {
		if campus.HasRealtime {
			hasRealtime = true
			errorTime := 0
			jwClassInfo, err := QueryOne(ctx, campus.Id)
			// 重试3次
			for err != nil && errorTime < 3 {
				time.Sleep(10 * time.Second)
				jwClassInfo, err = QueryOne(ctx, campus.Id)
				errorTime++
			}
			if err != nil {
				logs.CtxError(ctx, "query failed: %v", err)
				classInfo.IsFallback[campus.Name] = true
			} else {
				allRealtimeFailed = false
			}
			if err == nil && errorTime > 0 {
				logs.CtxWarn(ctx, "query retry success, error time: %v", errorTime)
			}
			// 即使查询报错也不返回，用已有数据进行兜底
			err = ProcessJWClassInfo(ctx, jwClassInfo, classInfo, campus)
			if err != nil {
				logs.CtxError(ctx, "process failed: %v", err)
				return nil, err
			}
		} else {
			// 没有实时API的校区，初始化空的CampusInfo
			if classInfo.CampusInfoMap == nil {
				classInfo.CampusInfoMap = map[string]*model.CampusInfo{}
			}
			classInfo.CampusInfoMap[campus.Name] = &model.CampusInfo{
				Name:            campus.Name,
				BuildingInfoMap: map[int]*model.BuildingInfo{},
				BuildingIdMap:   map[string]int{},
			}
		}
	}

	// 如果存在实时校区但全部失败，返回错误让 Cronjob 重试
	if hasRealtime && allRealtimeFailed {
		return nil, errors.New("all realtime campuses failed to fetch data")
	}

	// 通知时间检查
	startTime, _ := time.Parse("2006-01-02 15:04:05", sysConfig.Notification.Start)
	endTime, _ := time.Parse("2006-01-02 15:04:05", sysConfig.Notification.End)
	if time.Now().After(startTime) && time.Now().Before(endTime) {
		classInfo.Notification = &sysConfig.Notification
	} else {
		classInfo.Notification = nil
	}

	cache.SetCache(TodayCacheKey, classInfo, 2*time.Hour)
	return classInfo, nil
}

func ProcessJWClassInfo(ctx context.Context, jwClassInfo []model.JWClassInfo, classInfo *model.ClassInfo, campusConfig config.CampusConfig) error {
	if jwClassInfo == nil {
		return nil
	}
	campusInfo := model.CampusInfo{
		Name:            campusConfig.Name,
		BuildingInfoMap: map[int]*model.BuildingInfo{},
		BuildingIdMap:   map[string]int{},
		MaxBuildingId:   0,
	}
	if classInfo.CampusInfoMap != nil && classInfo.CampusInfoMap[campusConfig.Name] != nil {
		campusInfo = *classInfo.CampusInfoMap[campusConfig.Name]
	}
	for _, info := range jwClassInfo {
		classroomList := strings.Split(info.Classrooms, ",")
		for _, classroom := range classroomList {
			for _, replaceConfig := range campusConfig.ReplaceRegex {
				re, err := regexp.Compile(replaceConfig.Regex)
				if err != nil {
					logs.CtxError(ctx, "regex compile failed: %v", err)
					return err
				}
				classroom = re.ReplaceAllString(classroom, replaceConfig.Replace)
			}
			classroomInfo := model.ClassroomInfo{}
			var found bool
			var buildingName string
			buildingName, classroomInfo.Name, found = strings.Cut(strings.Split(classroom, "(")[0], "-")
			if !found {
				logs.CtxWarn(ctx, "classroom format error: %v", classroom)
				continue
			}
			classroomInfo.Size, _ = strconv.ParseInt(strings.Split(strings.Split(classroom, "(")[1], ")")[0], 10, 32)
			classroomInfo.CanTrust = true
			if _, ok := campusInfo.BuildingIdMap[buildingName]; !ok {
				campusInfo.BuildingIdMap[buildingName] = campusInfo.MaxBuildingId
				campusInfo.BuildingInfoMap[campusInfo.MaxBuildingId] = &model.BuildingInfo{
					Name:             buildingName,
					ClassroomInfoMap: map[int]*model.ClassroomInfo{},
					ClassroomIdMap:   map[string]int{},
					ClassMatrix:      [][]int{},
					MaxClassroomId:   0,
				}
				for i := 0; i < 14; i++ {
					campusInfo.BuildingInfoMap[campusInfo.MaxBuildingId].ClassMatrix = append(campusInfo.BuildingInfoMap[campusInfo.MaxBuildingId].ClassMatrix, []int{})
				}
				campusInfo.MaxBuildingId++
			}
			buildingId := campusInfo.BuildingIdMap[buildingName]
			if _, ok := campusInfo.BuildingInfoMap[buildingId].ClassroomIdMap[classroomInfo.Name]; !ok {
				campusInfo.BuildingInfoMap[buildingId].ClassroomIdMap[classroomInfo.Name] = campusInfo.BuildingInfoMap[buildingId].MaxClassroomId
				classroomInfo.BuildingId = buildingId
				campusInfo.BuildingInfoMap[buildingId].ClassroomInfoMap[campusInfo.BuildingInfoMap[buildingId].MaxClassroomId] = &classroomInfo
				campusInfo.BuildingInfoMap[buildingId].MaxClassroomId++
				for i := 0; i < 14; i++ {
					campusInfo.BuildingInfoMap[buildingId].ClassMatrix[i] = append(campusInfo.BuildingInfoMap[buildingId].ClassMatrix[i], 1)
				}
			} else if !campusInfo.BuildingInfoMap[buildingId].ClassroomInfoMap[campusInfo.BuildingInfoMap[buildingId].ClassroomIdMap[classroomInfo.Name]].CanTrust {
				// 覆盖旧数据（来自之前可能存在的课表数据）
				classroomInfo.BuildingId = buildingId
				campusInfo.BuildingInfoMap[buildingId].ClassroomInfoMap[campusInfo.BuildingInfoMap[buildingId].ClassroomIdMap[classroomInfo.Name]] = &classroomInfo
				for i := 0; i < 14; i++ {
					campusInfo.BuildingInfoMap[buildingId].ClassMatrix[i][campusInfo.BuildingInfoMap[buildingId].ClassroomIdMap[classroomInfo.Name]] = 1
				}
			}
			classroomId := campusInfo.BuildingInfoMap[buildingId].ClassroomIdMap[classroomInfo.Name]
			nodeName, err := strconv.ParseInt(info.NodeName, 10, 32)
			if err != nil {
				logs.CtxWarn(ctx, "node name parse failed: %v", err)
				continue
			}
			campusInfo.BuildingInfoMap[buildingId].ClassMatrix[nodeName-1][classroomId] = 0
		}
	}
	if classInfo.CampusInfoMap == nil {
		classInfo.CampusInfoMap = map[string]*model.CampusInfo{}
	}
	classInfo.CampusInfoMap[campusConfig.Name] = &campusInfo
	return nil
}

func GetData(ctx context.Context, c *gin.Context) {
	// 先尝试从缓存获取
	classInfoRaw, cacheTime, ok := cache.GetCacheWithExpiration(TodayCacheKey)
	if ok {
		// 如果缓存不到30分钟，直接返回
		if time.Now().Before(cacheTime.Add(30 * time.Minute)) {
			classInfo := classInfoRaw.(*model.ClassInfo)
			c.JSON(200, gin.H{
				"code": 0,
				"data": classInfo,
			})
			return
		}
		// 缓存超过30分钟，先返回旧数据，再异步刷新
		go func() {
			if !queryMu.TryLock() {
				return // 已有刷新在进行中
			}
			defer queryMu.Unlock()
			newCtx := logs.GenNewContext()
			QueryAll(newCtx)
		}()
		classInfo := classInfoRaw.(*model.ClassInfo)
		c.JSON(200, gin.H{
			"code": 0,
			"data": classInfo,
		})
		return
	}

	// 没有缓存，同步拉取新数据
	classInfo, err := QueryAll(ctx)
	if err != nil {
		c.JSON(500, gin.H{
			"code": 500,
			"msg":  "query failed",
			"data": nil,
		})
		return
	}
	c.JSON(200, gin.H{
		"code": 0,
		"data": classInfo,
	})
}
