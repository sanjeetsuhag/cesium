import Cartographic from "../Core/Cartographic.js";
import defaultValue from "../Core/defaultValue.js";
import defer from "../Core/defer.js";
import defined from "../Core/defined.js";
import Ellipsoid from "../Core/Ellipsoid.js";
import HeadingPitchRoll from "../Core/HeadingPitchRoll.js";
import CesiumMath from "../Core/Math.js";
import Matrix3 from "../Core/Matrix3.js";
import Matrix4 from "../Core/Matrix4.js";
import Resource from "../Core/Resource.js";
import Quaternion from "../Core/Quaternion.js";
import Transforms from "../Core/Transforms.js";
import Cesium3DTile from "./Cesium3DTile.js";
import I3SFeature from "./I3SFeature.js";
import I3SField from "./I3SField.js";
import I3SGeometry from "./I3SGeometry.js";

/**
 * This class implements an I3S Node. In CesiumJS each I3SNode creates a Cesium3DTile.
 * <p>
 * Do not construct this directly, instead access tiles through {@link I3SLayer}.
 * </p>
 * @alias I3SNode
 * @internalConstructor
 */
function I3SNode(parent, ref, isRoot) {
  let level;
  let layer;
  let nodeIndex;
  let resource;

  if (isRoot) {
    level = 0;
    layer = parent;
  } else {
    level = parent._level + 1;
    layer = parent._layer;
  }

  if (typeof ref === "number") {
    nodeIndex = ref;
  } else {
    resource = parent.resource.getDerivedResource({
      url: `${ref}/`,
    });
  }

  this._parent = parent;
  this._dataProvider = parent._dataProvider;
  this._isRoot = isRoot;
  this._level = level;
  this._layer = layer;
  this._nodeIndex = nodeIndex;
  this._resource = resource;

  this._tile = undefined;
  this._data = undefined;
  this._geometryData = [];
  this._featureData = [];
  this._fields = {};
  this._children = [];
  this._childrenReadyPromise = undefined;
  this._globalTransform = undefined;
  this._inverseGlobalTransform = undefined;
  this._inverseRotationMatrix = undefined;
}

Object.defineProperties(I3SNode.prototype, {
  /**
   * Gets the resource for the node.
   * @memberof I3SNode.prototype
   * @type {Resource}
   * @readonly
   */
  resource: {
    get: function () {
      return this._resource;
    },
  },
  /**
   * Gets the parent layer.
   * @memberof I3SNode.prototype
   * @type {I3SLayer}
   * @readonly
   */
  layer: {
    get: function () {
      return this._layer;
    },
  },
  /**
   * Gets the parent node.
   * @memberof I3SNode.prototype
   * @type {I3SNode|undefined}
   * @readonly
   */
  parent: {
    get: function () {
      return this._parent;
    },
  },
  /**
   * Gets the children nodes.
   * @memberof I3SNode.prototype
   * @type {I3SNode[]}
   * @readonly
   */
  children: {
    get: function () {
      return this._children;
    },
  },
  /**
   * Gets the collection of geometries.
   * @memberof I3SNode.prototype
   * @type {I3SGeometry[]}
   * @readonly
   */
  geometryData: {
    get: function () {
      return this._geometryData;
    },
  },
  /**
   * Gets the collection of features.
   * @memberof I3SNode.prototype
   * @type {I3SFeature[]}
   * @readonly
   */
  featureData: {
    get: function () {
      return this._featureData;
    },
  },
  /**
   * Gets the collection of fields.
   * @memberof I3SNode.prototype
   * @type {I3SField[]}
   * @readonly
   */
  fields: {
    get: function () {
      return this._fields;
    },
  },
  /**
   * Gets the Cesium3DTile for this node.
   * @memberof I3SNode.prototype
   * @type {Cesium3DTile}
   * @readonly
   */
  tile: {
    get: function () {
      return this._tile;
    },
  },
  /**
   * Gets the I3S data for this object.
   * @memberof I3SNode.prototype
   * @type {Object}
   * @readonly
   */
  data: {
    get: function () {
      return this._data;
    },
  },
});

/**
 * @private
 */
I3SNode.prototype.load = function () {
  const that = this;

  function processData() {
    if (!that._isRoot) {
      // Create a new tile
      const tileDefinition = that._create3DTileDefinition();

      that._tile = new Cesium3DTile(
        that._layer._tileset,
        that._dataProvider.resource,
        tileDefinition,
        that._parent._tile
      );

      that._tile._i3sNode = that;
    }
  }

  // If we don't have a nodepage index load from json
  if (!defined(this._nodeIndex)) {
    return this._dataProvider._loadJson(this._resource).then(function (data) {
      // Success
      that._data = data;
      processData();
    });
  }

  return this._layer._getNodeInNodePages(this._nodeIndex).then(function (node) {
    that._data = node;
    let uri;
    if (that._isRoot) {
      uri = "nodes/root/";
    } else if (defined(node.mesh)) {
      const uriIndex = node.mesh.geometry.resource;
      uri = `../${uriIndex}/`;
    }
    if (defined(uri)) {
      that._resource = that._parent.resource.getDerivedResource({ url: uri });
    }

    processData();
  });
};

/**
 * Loads the node fields.
 * @returns {Promise.<void>} A promise that is resolved when the I3S Node fields are loaded
 */
I3SNode.prototype.loadFields = function () {
  // Check if we must load fields
  const fields = this._layer._data.attributeStorageInfo;

  const that = this;
  function createAndLoadField(fields, index) {
    const newField = new I3SField(that, fields[index]);
    that._fields[newField._storageInfo.name] = newField;
    return newField.load();
  }

  const promises = [];
  if (defined(fields)) {
    for (let i = 0; i < fields.length; i++) {
      promises.push(createAndLoadField(fields, i));
    }
  }

  return Promise.all(promises);
};

/**
 * @private
 */
I3SNode.prototype._loadChildren = function () {
  const that = this;
  // If the promise for loading the children was already created, just return it
  if (defined(this._childrenReadyPromise)) {
    return this._childrenReadyPromise;
  }

  const childPromises = [];
  if (defined(that._data.children)) {
    for (
      let childIndex = 0;
      childIndex < that._data.children.length;
      childIndex++
    ) {
      const child = that._data.children[childIndex];
      const newChild = new I3SNode(
        that,
        defaultValue(child.href, child),
        false
      );
      that._children.push(newChild);
      childPromises.push(newChild.load());
    }
  }

  this._childrenReadyPromise = Promise.all(childPromises).then(function () {
    for (let i = 0; i < that._children.length; i++) {
      that._tile.children.push(that._children[i]._tile);
    }
  });

  return this._childrenReadyPromise;
};

/**
 * @private
 */
I3SNode.prototype._loadGeometryData = function () {
  const geometryPromises = [];

  // To debug decoding for a specific tile, add a condition
  // that wraps this if/else to match the tile uri
  if (defined(this._data.geometryData)) {
    for (
      let geomIndex = 0;
      geomIndex < this._data.geometryData.length;
      geomIndex++
    ) {
      const curGeometryData = new I3SGeometry(
        this,
        this._data.geometryData[geomIndex].href
      );
      this._geometryData.push(curGeometryData);
      geometryPromises.push(curGeometryData.load());
    }
  } else if (defined(this._data.mesh)) {
    const geometryDefinition = this._layer._findBestGeometryBuffers(
      this._data.mesh.geometry.definition,
      ["position", "uv0"]
    );

    const geometryURI = `./geometries/${geometryDefinition.bufferIndex}/`;
    const newGeometryData = new I3SGeometry(this, geometryURI);
    newGeometryData._geometryDefinitions = geometryDefinition.definition;
    newGeometryData._geometryBufferInfo = geometryDefinition.geometryBufferInfo;
    this._geometryData.push(newGeometryData);
    geometryPromises.push(newGeometryData.load());
  }

  return Promise.all(geometryPromises);
};

/**
 * @private
 */
I3SNode.prototype._loadFeatureData = function () {
  const featurePromises = [];

  // To debug decoding for a specific tile, add a condition
  // that wraps this if/else to match the tile uri
  if (defined(this._data.featureData)) {
    for (
      let featureIndex = 0;
      featureIndex < this._data.featureData.length;
      featureIndex++
    ) {
      const newFeatureData = new I3SFeature(
        this,
        this._data.featureData[featureIndex].href
      );
      this._featureData.push(newFeatureData);
      featurePromises.push(newFeatureData.load());
    }
  } else if (defined(this._data.mesh) && defined(this._data.mesh.attribute)) {
    const featureURI = `./features/0`;
    const newFeatureData = new I3SFeature(this, featureURI);
    this._featureData.push(newFeatureData);
    featurePromises.push(newFeatureData.load());
  }

  return Promise.all(featurePromises);
};

/**
 * @private
 */
I3SNode.prototype._clearGeometryData = function () {
  this._geometryData = [];
};

/**
 * @private
 */
I3SNode.prototype._create3DTileDefinition = function () {
  const obb = this._data.obb;
  const mbs = this._data.mbs;

  if (!defined(obb) && !defined(mbs)) {
    console.error("Failed to load I3S node. Bounding volume is required.");
    return undefined;
  }

  let geoPosition;

  if (defined(obb)) {
    geoPosition = Cartographic.fromDegrees(
      obb.center[0],
      obb.center[1],
      obb.center[2]
    );
  } else {
    geoPosition = Cartographic.fromDegrees(mbs[0], mbs[1], mbs[2]);
  }

  // Offset bounding box position if we have a geoid service defined
  if (defined(this._dataProvider._geoidDataList) && defined(geoPosition)) {
    for (let i = 0; i < this._dataProvider._geoidDataList.length; i++) {
      const tile = this._dataProvider._geoidDataList[i];
      const projectedPos = tile.projection.project(geoPosition);
      if (
        projectedPos.x > tile.nativeExtent.west &&
        projectedPos.x < tile.nativeExtent.east &&
        projectedPos.y > tile.nativeExtent.south &&
        projectedPos.y < tile.nativeExtent.north
      ) {
        geoPosition.height += sampleGeoid(projectedPos.x, projectedPos.y, tile);
        break;
      }
    }
  }

  let boundingVolume = {};
  let position;
  let span = 0;
  if (defined(obb)) {
    boundingVolume = {
      box: [
        0,
        0,
        0,
        obb.halfSize[0],
        0,
        0,
        0,
        obb.halfSize[1],
        0,
        0,
        0,
        obb.halfSize[2],
      ],
    };
    span = Math.max(
      Math.max(this._data.obb.halfSize[0], this._data.obb.halfSize[1]),
      this._data.obb.halfSize[2]
    );
    position = Ellipsoid.WGS84.cartographicToCartesian(geoPosition);
  } else {
    boundingVolume = {
      sphere: [0, 0, 0, mbs[3]],
    };
    position = Ellipsoid.WGS84.cartographicToCartesian(geoPosition);
    span = this._data.mbs[3];
  }
  span *= 2;
  // Compute the geometric error
  let metersPerPixel = Infinity;

  // Get the meters/pixel density required to pop the next LOD
  if (defined(this._data.lodThreshold)) {
    if (
      this._layer._data.nodePages.lodSelectionMetricType ===
      "maxScreenThresholdSQ"
    ) {
      const maxScreenThreshold = Math.sqrt(
        this._data.lodThreshold / (Math.PI * 0.25)
      );
      metersPerPixel = span / maxScreenThreshold;
    } else if (
      this._layer._data.nodePages.lodSelectionMetricType ===
      "maxScreenThreshold"
    ) {
      const maxScreenThreshold = this._data.lodThreshold;
      metersPerPixel = span / maxScreenThreshold;
    } else {
      // Other LOD selection types can only be used for point cloud data
      console.error("Invalid lodSelectionMetricType in Layer");
    }
  } else if (defined(this._data.lodSelection)) {
    for (
      let lodIndex = 0;
      lodIndex < this._data.lodSelection.length;
      lodIndex++
    ) {
      if (
        this._data.lodSelection[lodIndex].metricType === "maxScreenThreshold"
      ) {
        metersPerPixel = span / this._data.lodSelection[lodIndex].maxError;
      }
    }
  }

  if (metersPerPixel === Infinity) {
    metersPerPixel = 100000;
  }

  // Calculate the length of 16 pixels in order to trigger the screen space error
  const geometricError = metersPerPixel * 16;

  // Transformations
  const hpr = new HeadingPitchRoll(0, 0, 0);
  let orientation = Transforms.headingPitchRollQuaternion(position, hpr);

  if (defined(this._data.obb)) {
    orientation = new Quaternion(
      this._data.obb.quaternion[0],
      this._data.obb.quaternion[1],
      this._data.obb.quaternion[2],
      this._data.obb.quaternion[3]
    );
  }

  const rotationMatrix = Matrix3.fromQuaternion(orientation);
  const inverseRotationMatrix = Matrix3.inverse(rotationMatrix, new Matrix3());

  const globalTransform = new Matrix4(
    rotationMatrix[0],
    rotationMatrix[1],
    rotationMatrix[2],
    0,
    rotationMatrix[3],
    rotationMatrix[4],
    rotationMatrix[5],
    0,
    rotationMatrix[6],
    rotationMatrix[7],
    rotationMatrix[8],
    0,
    position.x,
    position.y,
    position.z,
    1
  );

  const inverseGlobalTransform = Matrix4.inverse(
    globalTransform,
    new Matrix4()
  );

  const localTransform = Matrix4.clone(globalTransform);

  if (defined(this._parent._globalTransform)) {
    Matrix4.multiply(
      globalTransform,
      this._parent._inverseGlobalTransform,
      localTransform
    );
  }

  this._globalTransform = globalTransform;
  this._inverseGlobalTransform = inverseGlobalTransform;
  this._inverseRotationMatrix = inverseRotationMatrix;

  // get children definition
  const childrenDefinition = [];
  for (let childIndex = 0; childIndex < this._children.length; childIndex++) {
    childrenDefinition.push(
      this._children[childIndex]._create3DTileDefinition()
    );
  }

  // Create a tile set
  const inPlaceTileDefinition = {
    children: childrenDefinition,
    refine: "REPLACE",
    boundingVolume: boundingVolume,
    transform: [
      localTransform[0],
      localTransform[4],
      localTransform[8],
      localTransform[12],
      localTransform[1],
      localTransform[5],
      localTransform[9],
      localTransform[13],
      localTransform[2],
      localTransform[6],
      localTransform[10],
      localTransform[14],
      localTransform[3],
      localTransform[7],
      localTransform[11],
      localTransform[15],
    ],
    content: {
      uri: defined(this._resource) ? this._resource.url : undefined,
    },
    geometricError: geometricError,
  };

  return inPlaceTileDefinition;
};

/**
 * @private
 */
I3SNode.prototype._createI3SDecoderTask = function (dataProvider, data) {
  // Prepare the data to send to the worker
  const parentData = data.geometryData._parent._data;
  const parentRotationInverseMatrix =
    data.geometryData._parent._inverseRotationMatrix;

  let longitude = 0.0;
  let latitude = 0.0;
  let height = 0.0;

  if (defined(parentData.obb)) {
    longitude = parentData.obb.center[0];
    latitude = parentData.obb.center[1];
    height = parentData.obb.center[2];
  } else if (defined(parentData.mbs)) {
    longitude = parentData.mbs[0];
    latitude = parentData.mbs[1];
    height = parentData.mbs[2];
  }

  const axisFlipRotation = Matrix3.fromRotationX(-CesiumMath.PI_OVER_TWO);
  const parentRotation = new Matrix3();

  Matrix3.multiply(
    axisFlipRotation,
    parentRotationInverseMatrix,
    parentRotation
  );

  const cartographicCenter = Cartographic.fromDegrees(
    longitude,
    latitude,
    height
  );

  const cartesianCenter = Ellipsoid.WGS84.cartographicToCartesian(
    cartographicCenter
  );

  const payload = {
    binaryData: data.geometryData._data,
    featureData:
      defined(data.featureData) && defined(data.featureData[0])
        ? data.featureData[0].data
        : undefined,
    schema: data.defaultGeometrySchema,
    bufferInfo: data.geometryData._geometryBufferInfo,
    ellipsoidRadiiSquare: Ellipsoid.WGS84.radiiSquared,
    url: data.url,
    geoidDataList: data.geometryData._dataProvider._geoidDataList,
    cartographicCenter: cartographicCenter,
    cartesianCenter: cartesianCenter,
    parentRotation: parentRotation,
  };

  const decodeI3STaskProcessor = dataProvider._getDecoderTaskProcessor();

  const transferrableObjects = [];
  return dataProvider._taskProcessorReadyPromise.then(function () {
    return decodeI3STaskProcessor.scheduleTask(payload, transferrableObjects);
  });
};

/**
 * @private
 */
I3SNode.prototype._createContentURL = function () {
  let rawGltf = {
    scene: 0,
    scenes: [
      {
        nodes: [0],
      },
    ],
    nodes: [
      {
        name: "singleNode",
      },
    ],
    meshes: [],
    buffers: [],
    bufferViews: [],
    accessors: [],
    materials: [],
    textures: [],
    images: [],
    samplers: [],
    asset: {
      version: "2.0",
    },
  };

  // Load the geometry data
  const dataPromises = [this._loadFeatureData(), this._loadGeometryData()];

  const that = this;
  return Promise.all(dataPromises).then(function () {
    // Binary glTF
    let generateGltfPromise = Promise.resolve();
    if (defined(that._geometryData) && that._geometryData.length > 0) {
      const parameters = {
        geometryData: that._geometryData[0],
        featureData: that._featureData,
        defaultGeometrySchema: that._layer._data.store.defaultGeometrySchema,
        url: that._geometryData[0].resource.url,
        tile: that._tile,
      };

      const task = that._createI3SDecoderTask(that._dataProvider, parameters);
      if (!defined(task)) {
        // Postponed
        return;
      }

      generateGltfPromise = task.then(function (result) {
        rawGltf = parameters.geometryData._generateGltf(
          result.meshData.nodesInScene,
          result.meshData.nodes,
          result.meshData.meshes,
          result.meshData.buffers,
          result.meshData.bufferViews,
          result.meshData.accessors
        );

        that._geometryData[0]._customAttributes =
          result.meshData._customAttributes;
      });
    }

    return generateGltfPromise.then(function () {
      const binaryGltfData = that._dataProvider._binarizeGltf(rawGltf);
      const glbDataBlob = new Blob([binaryGltfData], {
        type: "application/binary",
      });
      that._glbURL = URL.createObjectURL(glbDataBlob);
    });
  });
};

// Reimplement Cesium3DTile.prototype.requestContent so that
// We get a chance to load our own gltf from I3S data
Cesium3DTile.prototype._hookedRequestContent =
  Cesium3DTile.prototype.requestContent;

/**
 * @private
 */
Cesium3DTile.prototype._resolveHookedObject = function () {
  const that = this;
  // Keep a handle on the early promises
  // Call the real requestContent function
  this._hookedRequestContent();

  // Fulfill the promises
  this._contentReadyToProcessPromise.then(function () {
    that._contentReadyToProcessDefer.resolve();
  });

  this._contentReadyPromise.then(function (content) {
    that._isLoading = false;
    that._contentReadyDefer.resolve(content);
  });
};

Cesium3DTile.prototype.requestContent = function () {
  const that = this;
  if (!this.tileset._isI3STileSet) {
    return this._hookedRequestContent();
  }

  if (!this._isLoading) {
    this._isLoading = true;

    // Create early promises that will be fulfilled later
    this._contentReadyToProcessDefer = defer();
    this._contentReadyDefer = defer();
    this._contentReadyToProcessPromise = this._contentReadyToProcessDefer.promise;
    this._contentReadyPromise = this._contentReadyDefer.promise;

    this._i3sNode._createContentURL().then(function () {
      that._contentResource = new Resource({ url: that._i3sNode._glbURL });
      that._resolveHookedObject();
    });

    // Returns the number of requests
    return 0;
  }

  return 1;
};

function bilinearInterpolate(tx, ty, h00, h10, h01, h11) {
  const a = h00 * (1 - tx) + h10 * tx;
  const b = h01 * (1 - tx) + h11 * tx;
  return a * (1 - ty) + b * ty;
}

function sampleMap(u, v, width, data) {
  const address = u + v * width;
  return data[address];
}

function sampleGeoid(sampleX, sampleY, geoidData) {
  const extent = geoidData.nativeExtent;
  let x =
    ((sampleX - extent.west) / (extent.east - extent.west)) *
    (geoidData.width - 1);
  let y =
    ((sampleY - extent.south) / (extent.north - extent.south)) *
    (geoidData.height - 1);
  const xi = Math.floor(x);
  let yi = Math.floor(y);

  x -= xi;
  y -= yi;

  const xNext = xi < geoidData.width ? xi + 1 : xi;
  let yNext = yi < geoidData.height ? yi + 1 : yi;

  yi = geoidData.height - 1 - yi;
  yNext = geoidData.height - 1 - yNext;

  const h00 = sampleMap(xi, yi, geoidData.width, geoidData.buffer);
  const h10 = sampleMap(xNext, yi, geoidData.width, geoidData.buffer);
  const h01 = sampleMap(xi, yNext, geoidData.width, geoidData.buffer);
  const h11 = sampleMap(xNext, yNext, geoidData.width, geoidData.buffer);

  let finalHeight = bilinearInterpolate(x, y, h00, h10, h01, h11);
  finalHeight = finalHeight * geoidData.scale + geoidData.offset;
  return finalHeight;
}

Object.defineProperties(Cesium3DTile.prototype, {
  /**
   * Gets the I3S Node for the tile.
   * @memberof Cesium3DTile.prototype
   * @type {String}
   */
  i3sNode: {
    get: function () {
      return this._i3sNode;
    },
  },
});

export default I3SNode;
