// 画面点位数据
let pointArr = [];
// 当前点位的数据
let nowPoint = [];
// 当前多边形中的点和线实体集合
let pointAndLineEntity = {
  pointEntityArr: [],
  lineEntityArr: [],
  demoLineEntityArr: [],
  selectedPolygon: [],
};
// 当前选择的编辑点
let nowEditPoint = [];
let selectLabelEntity; //
// 是否开始画多边形
let isDrawLine = false;
// 是否编辑
let isEditable = false;

// 事件处理类
class DrawTools {
  // 删除实体
  delDemoEntity(name) {
    const entityTypes = {
      point_name: pointAndLineEntity.pointEntityArr,
      line_name: pointAndLineEntity.lineEntityArr,
      line_demo_name: pointAndLineEntity.demoLineEntityArr,
    };

    const entities = entityTypes[name];
    if (entities) {
      entities.forEach(item => this.viewer.entities.remove(item));
    }
  }

  // 经纬度转换
  getLonOrLat(cartesian2) {
    const cartesian = this.viewer.scene.globe.pick(
      this.viewer.camera.getPickRay(cartesian2),
      this.viewer.scene
    );
    if (!cartesian) return null;

    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
    };
  }

  // 根据经纬度坐标计算出中心点
  calculateCenter(coordinates) {
    let totalX = 0;
    let totalY = 0;
    let totalZ = 0;
    let count = coordinates.length;

    for (let i = 0; i < count; i++) {
      totalX += coordinates[i].x;
      totalY += coordinates[i].y;
      totalZ += coordinates[i].z;
    }

    let centerX = totalX / count;
    let centerY = totalY / count;
    let centerZ = totalZ / count;

    return [centerX, centerY, centerZ];
  }

  // 画点
  drawPoint(lonAndLat) {
    return this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(...lonAndLat),
      name: 'point_name',
      point: {
        color: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        pixelSize: 8,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, // 贴地
      },
    });
  }

  // 画线
  drawLine(name, lineArr) {
    return this.viewer.entities.add({
      name: name,
      polyline: {
        clampToGround: true, // 开启贴地
        positions: new Cesium.CallbackProperty(() => {
          return Cesium.Cartesian3.fromDegreesArrayHeights(lineArr);
        }, false),
        width: 5,
        material: Cesium.Color.BLUE,
      },
    });
  }

  // 画多边形
  drawPolyGon(lonAndLat) {
    const lonLats = data => {
      return data
        .filter(d => d[0] >= -180 && d[0] <= 180 && d[1] >= -90 && d[1] <= 90)
        .flatMap(d => [d[0], d[1]]);
    };

    this.viewer.entities.add({
      name: 'polyGon_name',
      polygon: {
        clampToGround: true, // 开启贴地
        hierarchy: new Cesium.PolygonHierarchy(
          Cesium.Cartesian3.fromDegreesArray(lonLats(lonAndLat))
        ),
        material: Cesium.Color.BLUE.withAlpha(0.5),
      },
    });
  }

  // 画标签label
  drawLabel = (id, pos) => {
    return this.viewer.entities.add({
      name: id,
      position: new Cesium.Cartesian3(...pos),
      label: {
        text: 'X',
        font: '10px sans-serif',
        fillColor: Cesium.Color.RED,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
  };

  removeByType = type => {
    const entities = this.viewer.entities.values;
    const removeList = entities.filter(i => i[type]);
    removeList.forEach(i => {
      this.viewer.entities.remove(i);
    });
  };

  // 清除选中状态
  clearEntitiesByName = flagText => {
    const entities = this.viewer.entities.values;
    const targetEntities = entities.filter(i => i.name === flagText || i.id === flagText);
    targetEntities.forEach(i => {
      this.viewer.entities.remove(i);
    });
  };

  // 处理左击事件
  handleLeftClick(event) {
    const pick = this.viewer.scene.pick(event.position);
    if (pick && pick.id.label) {
      // 删除多边形
      this.clearEntitiesByName(pick.id.name);
      this.clearEntities();
      this.viewer.scene.requestRender();
      return;
    }

    if (pick && pick.id && pick.id.polygon && !isDrawLine) {
      this.createEditPoints(pick);
    } else if (pick && pick.id && pick.id.point && !isDrawLine) {
      this.startEditing(pick);
    } else if (!isEditable) {
      isDrawLine = true;
      this.drawPolygoon(event);
    }
  }

  // 创建编辑点
  createEditPoints(pick) {
    // 清空状态
    this.clearEntities();
    this.removeByType('label');

    let positions;

    if (pick.id.polygon.hierarchy._callback) {
      // 获取callbackproperty的数据
      positions = pick.id.polygon.hierarchy._callback().positions;
    } else {
      positions = pick.id.polygon.hierarchy._value.positions;
    }
    for (let cartesian of positions) {
      const point = this.viewer.entities.add({
        name: 'editablePoint',
        position: cartesian,
        point: {
          color: Cesium.Color.WHITE,
          pixelSize: 8,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY, //
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, // 贴地设置
        },
      });

      pointAndLineEntity.pointEntityArr.push(point);
    }
    pointAndLineEntity.selectedPolygon.push(pick);

    // 计算中心点
    const centerPoint = this.calculateCenter(positions);
    selectLabelEntity = this.drawLabel(pick.id.id, centerPoint);

    // 重新渲染
    this.viewer.scene.requestRender();
  }

  // 开始编辑
  startEditing(pick) {
    nowEditPoint = [pick];
    isEditable = true;
  }

  // 绘制
  drawPolygoon(event) {
    const nowPosition = this.getLonOrLat(event.position);
    if (!nowPosition) return;

    pointArr.push([nowPosition.longitude, nowPosition.latitude, 0]);
    nowPoint = [nowPosition.longitude, nowPosition.latitude, 0];

    const point = this.drawPoint(nowPoint);
    pointAndLineEntity.pointEntityArr.push(point);
    this.viewer.scene.requestRender();

    if (pointArr.length > 1) {
      this.delDemoEntity('line_demo_name');
      const line = this.drawLine('line_name', [...pointArr[pointArr.length - 2], ...nowPoint]);
      pointAndLineEntity.lineEntityArr.push(line);
    }
  }

  // 处理鼠标移动事件
  handleMouseMove(event) {
    this.showPointer(event);

    if (isDrawLine && !isEditable) {
      this.handleMouseMoveDrawing(event);
    } else if (isEditable && !isDrawLine) {
      this.handleMouseMoveEditing(event);
    }
  }

  // 处理绘制时的鼠标移动
  handleMouseMoveDrawing(event) {
    const movePosition = this.getLonOrLat(event.startPosition);
    if (!movePosition) return;

    this.delDemoEntity('line_demo_name');
    const demoLine = this.drawLine('line_demo_name', [
      ...nowPoint,
      ...[movePosition.longitude, movePosition.latitude, 0],
    ]);
    pointAndLineEntity.demoLineEntityArr.push(demoLine);
    this.viewer.scene.requestRender();
  }

  // 处理编辑时的鼠标移动
  handleMouseMoveEditing(event) {
    const movePosition = this.getLonOrLat(event.startPosition);
    if (!movePosition) return;

    nowEditPoint[0].id.position = Cesium.Cartesian3.fromDegrees(
      movePosition.longitude,
      movePosition.latitude,
      0
    );

    // 更新多边形的回调属性
    const positions = pointAndLineEntity.pointEntityArr.map(item =>
      item.position.getValue(Cesium.JulianDate.now())
    );

    // 实时更新多边形的坐标
    pointAndLineEntity.selectedPolygon[0].id.polygon.hierarchy = new Cesium.CallbackProperty(() => {
      return new Cesium.PolygonHierarchy(positions);
    }, false);

    // 实时更新中心点信息
    const centerPoint = this.calculateCenter(positions);
    selectLabelEntity.position = new Cesium.CallbackProperty(() => {
      return new Cesium.Cartesian3(...centerPoint);
    }, false);

    this.viewer.scene.requestRender();
  }

  // 显示小手
  showPointer = movement => {
    // 获取鼠标下的实体
    const pickedObject = this.viewer.scene.pick(movement.endPosition);
    // 如果鼠标悬停在 Label 上，则显示小手
    if (Cesium.defined(pickedObject) && pickedObject.id.label) {
      this.viewer.canvas.style.cursor = 'pointer';
    } else {
      this.viewer.canvas.style.cursor = 'default';
    }
  };

  // 处理右击事件
  handleRightClick() {
    if (!isEditable && isDrawLine) {
      this.finishDrawingPolygon();
    } else if (isEditable && !isDrawLine) {
      isEditable = false;
    }
  }

  // 完成多边形绘制
  finishDrawingPolygon() {
    isDrawLine = false;
    this.drawPolyGon(pointArr);

    this.clearEntities();
  }

  // 清空实体
  clearEntities() {
    this.removeByType('label');
    this.clearEntitiesByName('editablePoint');
    this.delDemoEntity('line_demo_name');
    this.delDemoEntity('line_name');
    this.delDemoEntity('point_name');
    pointArr = [];
    nowPoint = [];
    pointAndLineEntity = {
      pointEntityArr: [],
      lineEntityArr: [],
      demoLineEntityArr: [],
      selectedPolygon: [],
    };
  }

  // 初始化事件
  init(viewer) {
    if (this.viewer) return;
    this.viewer = viewer;
    this.handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    this.handler.setInputAction(
      this.handleLeftClick.bind(this),
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );
    this.handler.setInputAction(
      this.handleMouseMove.bind(this),
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );
    this.handler.setInputAction(
      this.handleRightClick.bind(this),
      Cesium.ScreenSpaceEventType.RIGHT_CLICK
    );
  }

  // 销毁事件
  destory() {
    this.clearEntities();
    this.viewer.entities.removeAll();
    this.viewer.scene.requestRender();
    this.handler.destroy();
    this.viewer = null;
  }
}
