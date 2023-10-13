import { action, computed, makeObservable } from "mobx";
import {
  IconGlyph,
  SelectableDimensionColor,
  SelectableDimensionWorkflow
} from "terriajs-plugin-api";
import filterOutUndefined from "../../Core/filterOutUndefined";
import Cesium3dTilesMixin from "../../ModelMixins/Cesium3dTilesMixin";
import Icon from "../../Styled/Icon";

export default class Cesium3DTilesStylingWorkflow
  implements SelectableDimensionWorkflow
{
  static type = "3d-tiles-styling";

  constructor(readonly item: Cesium3dTilesMixin.Instance) {
    makeObservable(this);
  }

  get icon() {
    return Icon.GLYPHS.eye;
  }

  get name() {
    return "Style";
  }

  get footer() {
    return {
      buttonText: "kleks",
      onClick: action(() => {
        console.log("kleks");
      })
    };
  }

  @computed
  get selectableDimensions() {
    return [];
  }

  get colors(): SelectableDimensionColor {
    return {
      type: "color",
      setDimensionValue: (stratumId, value) => {
        console.log({ stratumId, value });
        // this.item.setTrait(stratumId, "activeStyle", value)
      }
    };
  }
}
