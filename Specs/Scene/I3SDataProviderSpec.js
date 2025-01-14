import {
  GeographicTilingScheme,
  I3SDataProvider,
  Math as CesiumMath,
  Rectangle,
  Resource,
} from "../../Source/Cesium.js";

describe("Scene/I3SDataProvider", function () {
  const mockTileset = {
    destroy: function () {},
    isDestroyed: function () {
      return false;
    },
    update: function (frameState) {},
    prePassesUpdate: function (frameState) {},
    postPassesUpdate: function (frameState) {},
    updateForPass: function (frameState, passState) {},
  };
  const mockTilesetReady = {
    destroy: function () {},
    isDestroyed: function () {
      return false;
    },
    update: function (frameState) {},
    prePassesUpdate: function (frameState) {},
    postPassesUpdate: function (frameState) {},
    updateForPass: function (frameState, passState) {},
    ready: true,
  };

  const mockLayers = [
    {
      _tileset: mockTileset,
    },
    {
      _tileset: mockTilesetReady,
    },
    {
      // Need to handle the case of undefined tilesets because update may be called before they're created
      _tileset: undefined,
    },
  ];

  const geoidTiles = [
    [
      {
        _buffer: new Float32Array([0, 1, 2, 3]),
        _encoding: 0,
        _height: 2,
        _structure: {
          elementMultiplier: 1,
          elementsPerHeight: 1,
          heightOffset: 0,
          heightScale: 1,
          isBigEndian: false,
          stride: 1,
        },
        _width: 2,
      },
    ],
    [
      {
        _buffer: new Float32Array([4, 5, 6, 7]),
        _encoding: 0,
        _height: 2,
        _structure: {
          elementMultiplier: 1,
          elementsPerHeight: 1,
          heightOffset: 0,
          heightScale: 1,
          isBigEndian: false,
          stride: 1,
        },
        _width: 2,
      },
    ],
  ];

  const mockGeoidProvider = {
    readyPromise: Promise.resolve(),
    _lodCount: 0,
    tilingScheme: new GeographicTilingScheme(),
    requestTileGeometry: function (x, y, level) {
      if (level === 0) {
        return Promise.resolve(geoidTiles[x][y]);
      }

      return undefined;
    },
  };

  const mockRootNodeData = {
    id: "root",
    level: 0,
    mbs: [-90, 45, 0, 28288.6903196],
    obb: {
      center: [-90, 45, 0],
      halfSize: [20000, 20000, 500],
      quaternion: [1, 0, 0, 0],
    },
    lodSelection: [
      { metricType: "maxScreenThresholdSQ", maxError: 4 },
      { metricType: "maxScreenThreshold", maxError: 2 },
    ],
    children: [],
  };

  const mockLayerData = {
    href: "layers/0/",
    attributeStorageInfo: [],
    store: { rootNode: "mockRootNodeUrl" },
    fullExtent: { xmin: 0, ymin: 1, xmax: 2, ymax: 3 },
    spatialReference: { wkid: 4326 },
    id: 0,
  };

  const mockProviderData = {
    name: "mockProviderName",
    serviceVersion: "1.6",
    layers: [mockLayerData],
  };

  it("constructs default I3SDataProvider", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });

    expect(testProvider.name).toEqual("testProvider");
    expect(testProvider.traceFetches).toEqual(false);
    expect(testProvider.geoidTiledServiceProvider).toBeUndefined();
  });

  it("constructs I3SDataProvider with options", function () {
    const geoidService = {};
    const cesium3dTilesetOptions = {
      skipLevelOfDetail: true,
      debugShowBoundingVolume: false,
      maximumScreenSpaceError: 16,
    };
    const i3sOptions = {
      url: "mockProviderUrl",
      name: "testProvider",
      traceFetches: true, // for tracing I3S fetches
      geoidTiledTerrainProvider: geoidService, // pass the geoid service
      cesium3dTilesetOptions: cesium3dTilesetOptions,
    };

    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider(i3sOptions);

    expect(testProvider.name).toEqual("testProvider");
    expect(testProvider.traceFetches).toEqual(true);
    expect(testProvider.geoidTiledTerrainProvider).toEqual(geoidService);
  });

  it("sets properties", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });

    testProvider.traceFetches = true;

    expect(testProvider.traceFetches).toEqual(true);
  });

  it("wraps update", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });
    testProvider._layers = mockLayers;

    spyOn(testProvider._layers[0]._tileset, "update");
    spyOn(testProvider._layers[1]._tileset, "update");

    const frameState = {};
    testProvider.update(frameState);

    // Function should not be called for tilesets that are not yet ready
    expect(testProvider._layers[0]._tileset.update).not.toHaveBeenCalled();
    expect(testProvider._layers[1]._tileset.update).toHaveBeenCalledWith(
      frameState
    );
  });

  it("wraps prePassesUpdate", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });
    testProvider._layers = mockLayers;

    spyOn(testProvider._layers[0]._tileset, "prePassesUpdate");
    spyOn(testProvider._layers[1]._tileset, "prePassesUpdate");

    const frameState = {};
    testProvider.prePassesUpdate(frameState);

    // Function should not be called for tilesets that are not yet ready
    expect(
      testProvider._layers[0]._tileset.prePassesUpdate
    ).not.toHaveBeenCalled();
    expect(
      testProvider._layers[1]._tileset.prePassesUpdate
    ).toHaveBeenCalledWith(frameState);
  });

  it("wraps postPassesUpdate", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });
    testProvider._layers = mockLayers;

    spyOn(testProvider._layers[0]._tileset, "postPassesUpdate");
    spyOn(testProvider._layers[1]._tileset, "postPassesUpdate");

    const frameState = {};
    testProvider.postPassesUpdate(frameState);

    // Function should not be called for tilesets that are not yet ready
    expect(
      testProvider._layers[0]._tileset.postPassesUpdate
    ).not.toHaveBeenCalled();
    expect(
      testProvider._layers[1]._tileset.postPassesUpdate
    ).toHaveBeenCalledWith(frameState);
  });

  it("wraps updateForPass", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });
    testProvider._layers = mockLayers;

    spyOn(testProvider._layers[0]._tileset, "updateForPass");
    spyOn(testProvider._layers[1]._tileset, "updateForPass");

    const frameState = {};
    const passState = { test: "test" };
    testProvider.updateForPass(frameState, passState);

    // Function should not be called for tilesets that are not yet ready
    expect(
      testProvider._layers[0]._tileset.updateForPass
    ).not.toHaveBeenCalled();
    expect(testProvider._layers[1]._tileset.updateForPass).toHaveBeenCalledWith(
      frameState,
      passState
    );
  });

  it("wraps show property", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });
    testProvider._layers = mockLayers;

    // Function should not be called for tilesets that are not yet ready
    testProvider.show = true;
    expect(testProvider._layers[0]._tileset.show).toEqual(true);
    expect(testProvider._layers[1]._tileset.show).toEqual(true);

    testProvider.show = false;
    expect(testProvider._layers[0]._tileset.show).toEqual(false);
    expect(testProvider._layers[1]._tileset.show).toEqual(false);
  });

  it("isDestroyed returns false for new provider", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });
    testProvider._layers = mockLayers;

    expect(testProvider.isDestroyed()).toEqual(false);
  });

  it("destroys provider", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });
    testProvider._layers = mockLayers;

    spyOn(mockTileset, "destroy");
    spyOn(mockTilesetReady, "destroy");

    testProvider.destroy();

    expect(mockTileset.destroy).toHaveBeenCalled();
    expect(mockTilesetReady.destroy).toHaveBeenCalled();

    expect(testProvider.isDestroyed()).toEqual(true);
  });

  it("loads binary", function () {
    const mockBinaryResponse = new ArrayBuffer(1);

    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });

    spyOn(Resource.prototype, "fetchArrayBuffer").and.returnValue(
      Promise.resolve(mockBinaryResponse)
    );

    const resource = Resource.createIfNeeded("mockBinaryUri");
    return testProvider._loadBinary(resource).then(function (result) {
      expect(Resource.prototype.fetchArrayBuffer).toHaveBeenCalled();
      expect(result).toBe(mockBinaryResponse);
    });
  });

  it("loads binary with traceFetches", function () {
    const mockBinaryResponse = new ArrayBuffer(1);

    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
      traceFetches: true,
    });

    spyOn(Resource.prototype, "fetchArrayBuffer").and.returnValue(
      Promise.resolve(mockBinaryResponse)
    );

    spyOn(console, "log");

    const resource = Resource.createIfNeeded("mockBinaryUri");
    return testProvider._loadBinary(resource).then(function (result) {
      expect(Resource.prototype.fetchArrayBuffer).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("I3S FETCH:", resource.url);
      expect(result).toBe(mockBinaryResponse);
    });
  });

  it("loads binary with invalid uri", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });

    const resource = Resource.createIfNeeded("mockBinaryUri");
    return testProvider
      ._loadBinary(resource)
      .then(function () {
        fail("Promise should not be resolved for invalid uri");
      })
      .catch(function (error) {
        expect(error.statusCode).toEqual(404);
      });
  });

  it("loads json", function () {
    const mockJsonResponse = { test: 1 };

    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });

    spyOn(Resource.prototype, "fetchJson").and.returnValue(
      Promise.resolve(mockJsonResponse)
    );

    const resource = Resource.createIfNeeded("mockJsonUri");
    return testProvider._loadJson(resource).then(function (result) {
      expect(Resource.prototype.fetchJson).toHaveBeenCalled();
      expect(result).toBe(mockJsonResponse);
    });
  });

  it("loads json with traceFetches enabled", function () {
    const mockJsonResponse = { test: 1 };

    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
      traceFetches: true,
    });

    spyOn(Resource.prototype, "fetchJson").and.returnValue(
      Promise.resolve(mockJsonResponse)
    );

    spyOn(console, "log");

    const resource = Resource.createIfNeeded("mockJsonUri");
    return testProvider._loadJson(resource).then(function (result) {
      expect(Resource.prototype.fetchJson).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("I3S FETCH:", resource.url);
      expect(result).toBe(mockJsonResponse);
    });
  });

  it("loadJson rejects invalid uri", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });

    const resource = Resource.createIfNeeded("mockJsonUri");
    return testProvider
      ._loadJson(resource)
      .then(function () {
        fail("Promise should not be resolved for invalid uri");
      })
      .catch(function (error) {
        expect(error.statusCode).toEqual(404);
      });
  });

  it("loadJson rejects error response", function () {
    const mockErrorResponse = {
      error: {
        code: 498,
        details: [
          "Token would have expired, regenerate token and send the request again.",
          "If the token is generated based on the referrer ma…mation is available with every request in header.",
        ],
        message: "Invalid Token.",
      },
    };

    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });

    spyOn(Resource.prototype, "fetchJson").and.returnValue(
      Promise.resolve(mockErrorResponse)
    );

    const resource = Resource.createIfNeeded("mockJsonUri");
    return testProvider
      ._loadJson(resource)
      .then(function () {
        fail("Promise should not be resolved for error response");
      })
      .catch(function (error) {
        expect(error).toBe(mockErrorResponse.error);
      });
  });

  it("loads geoid data", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
      geoidTiledTerrainProvider: mockGeoidProvider,
    });

    testProvider._extent = Rectangle.fromDegrees(-1, 0, 1, 2);

    return testProvider._loadGeoidData().then(function () {
      expect(testProvider._geoidDataList.length).toEqual(2);
      expect(testProvider._geoidDataList[0].height).toEqual(2);
      expect(testProvider._geoidDataList[0].width).toEqual(2);
      expect(testProvider._geoidDataList[0].buffer).toEqual(
        new Float32Array([0, 1, 2, 3])
      );

      expect(testProvider._geoidDataList[1].height).toEqual(2);
      expect(testProvider._geoidDataList[1].width).toEqual(2);
      expect(testProvider._geoidDataList[1].buffer).toEqual(
        new Float32Array([4, 5, 6, 7])
      );
    });
  });

  it("loadGeoidData resolves when no geoid provider is given", function () {
    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });
    testProvider._extent = Rectangle.fromDegrees(-1, 0, 1, 2);

    return testProvider._loadGeoidData().then(function () {
      expect(testProvider._geoidDataList).toBeUndefined();
    });
  });

  it("computes extent from layers", function () {
    const mockLayer1 = {
      _extent: Rectangle.fromDegrees(-1, 0, 1, 2),
    };
    const mockLayer2 = {
      _extent: Rectangle.fromDegrees(3, 1, 4, 3),
    };

    spyOn(I3SDataProvider.prototype, "_load");
    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
    });
    testProvider._layers = [mockLayer1, mockLayer2, {}];

    testProvider._computeExtent();
    expect(testProvider._extent.west).toEqual(CesiumMath.toRadians(-1));
    expect(testProvider._extent.south).toEqual(CesiumMath.toRadians(0));
    expect(testProvider._extent.east).toEqual(CesiumMath.toRadians(4));
    expect(testProvider._extent.north).toEqual(CesiumMath.toRadians(3));
  });

  it("loads i3s provider", function () {
    spyOn(I3SDataProvider, "_fetchJson").and.callFake(function (resource) {
      if (resource.url.endsWith("mockProviderUrl/layers/0/mockRootNodeUrl/")) {
        return Promise.resolve(mockRootNodeData);
      } else if (resource.url.endsWith("mockProviderUrl")) {
        return Promise.resolve(mockProviderData);
      }

      return Promise.reject();
    });

    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl",
      name: "testProvider",
      geoidTiledTerrainProvider: mockGeoidProvider,
    });

    return testProvider.readyPromise.then(function () {
      expect(testProvider.ready).toBe(true);

      // Layers have been populated and root node is loaded
      expect(testProvider.layers.length).toEqual(1);
      expect(testProvider.layers[0].rootNode.tile).toBeDefined();
      expect(testProvider.layers[0].rootNode.tile.i3sNode).toEqual(
        testProvider.layers[0].rootNode
      );

      // Expect geoid data to have been loaded
      expect(testProvider._geoidDataList.length).toEqual(1);
      expect(testProvider._geoidDataList[0].height).toEqual(2);
      expect(testProvider._geoidDataList[0].width).toEqual(2);
      expect(testProvider._geoidDataList[0].buffer).toEqual(
        new Float32Array([4, 5, 6, 7])
      );
    });
  });

  it("loads i3s provider from single layer url", function () {
    spyOn(I3SDataProvider, "_fetchJson").and.callFake(function (resource) {
      if (resource.url.endsWith("mockProviderUrl/layers/0/mockRootNodeUrl/")) {
        return Promise.resolve(mockRootNodeData);
      } else if (resource.url.endsWith("mockProviderUrl/layers/0/")) {
        return Promise.resolve(mockLayerData);
      }

      return Promise.reject();
    });

    const testProvider = new I3SDataProvider({
      url: "mockProviderUrl/layers/0/",
      name: "testProvider",
      geoidTiledTerrainProvider: mockGeoidProvider,
    });

    return testProvider.readyPromise.then(function () {
      expect(testProvider.ready).toBe(true);

      // Layers have been populated and root node is loaded
      expect(testProvider.layers.length).toEqual(1);
      expect(testProvider.layers[0].rootNode.tile).toBeDefined();
      expect(testProvider.layers[0].rootNode.tile.i3sNode).toEqual(
        testProvider.layers[0].rootNode
      );

      // Expect geoid data to have been loaded
      expect(testProvider._geoidDataList.length).toEqual(1);
      expect(testProvider._geoidDataList[0].height).toEqual(2);
      expect(testProvider._geoidDataList[0].width).toEqual(2);
      expect(testProvider._geoidDataList[0].buffer).toEqual(
        new Float32Array([4, 5, 6, 7])
      );
    });
  });
});
