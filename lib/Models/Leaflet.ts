import CesiumTileLayer from "../Map/CesiumTileLayer";
import GlobeOrMap, { CameraView } from "./GlobeOrMap";
import Mappable, { DataSource, ImageryParts } from "./Mappable";
import Terria from "./Terria";
import { autorun } from "mobx";
import { createTransformer } from "mobx-utils";

function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

export default class Leaflet implements GlobeOrMap {
    readonly terria: Terria;
    readonly map: L.Map;
    private _disposeWorkbenchMapItemsSubscription: (() => void) | undefined;

    constructor(terria: Terria, map: L.Map) {
        this.terria = terria;
        this.map = map;
    }

    observeModelLayer() {
        this._disposeWorkbenchMapItemsSubscription = autorun(() => {
            const catalogItems = [
                ...this.terria.workbench.items,
                this.terria.baseMap
            ];
            // Flatmap
            const allMapItems = ([] as (DataSource | ImageryParts)[]).concat(
                ...catalogItems
                    .filter(isDefined)
                    .filter(Mappable.is)
                    .map(item => item.mapItems)
            );

            const allImageryParts = allMapItems
                .filter(ImageryParts.is)
                .map(makeImageryLayerFromParts);

            this.map.eachLayer(layer => {
                if (allImageryParts.indexOf(layer) === -1) {
                    this.map.removeLayer(layer);
                }
            });

            allImageryParts.forEach(layer => {
                if (!this.map.hasLayer(layer)) {
                    this.map.addLayer(layer);
                }
            });
        });
    }

    zoomTo(
        viewOrExtent: CameraView | Cesium.Rectangle,
        flightDurationSeconds: number
    ): void {}
}

const createImageryLayer: (
    ip: Cesium.ImageryProvider
) => CesiumTileLayer = createTransformer((ip: Cesium.ImageryProvider) => {
    return new CesiumTileLayer(ip);
});

function makeImageryLayerFromParts(parts: ImageryParts): L.Layer {
    const layer = createImageryLayer(parts.imageryProvider);
    return layer;
}
