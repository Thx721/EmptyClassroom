export default CalculateEmptyClassroom;

function CalculateEmptyClassroom(classInfo, selectedCampus, selectedDate, selectedBuildings, selectedClassTimes) {
    // 只使用实时教务数据（没有课表）
    let classInfoOnSelectedDate = classInfo.campus_info_map[selectedCampus];
    if (!classInfoOnSelectedDate) {
        return [];
    }
    let emptyClassroomList = [];
    for (let buildingId of selectedBuildings) {
        const buildingInfo = classInfoOnSelectedDate.building_info_map[buildingId];
        if (!buildingInfo) continue;
        for (let classroomId in buildingInfo.classroom_info_map) {
            const classroomInfo = buildingInfo.classroom_info_map[classroomId];
            let emptyClassroom = {
                name: buildingInfo.name + '-' + classroomInfo.name,
                size: classroomInfo.size == 0 ? '无数据' : classroomInfo.size,
                can_trust: classroomInfo.can_trust,
                type: (classroomInfo.type == '' ? '无数据' : classroomInfo.type) ?? '无数据',
                building_name: buildingInfo.name,
                empty_class_time: []
            };
            for (let classTime of selectedClassTimes) {
                if (buildingInfo.class_matrix[classTime][classroomId] == 1) {
                    emptyClassroom = null;
                    break;
                }
            }
            if (emptyClassroom != null) {
                for (let classTime = 0; classTime < 14; classTime++) {
                    if (buildingInfo.class_matrix[classTime][classroomId] == 0) {
                        emptyClassroom.empty_class_time.push(classTime);
                    }
                }
                emptyClassroomList.push(emptyClassroom);
            }
        }
    }
    emptyClassroomList.sort((a, b) => {
        if (a.building_name != b.building_name) {
            return a.building_name > b.building_name ? 1 : -1;
        } else {
            return a.name > b.name ? 1 : -1;
        }
    });
    return emptyClassroomList;
}
