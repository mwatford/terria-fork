import i18next from "i18next";
import { computed, observable, runInAction } from "mobx";
import RequestErrorEvent from "terriajs-cesium/Source/Core/RequestErrorEvent";
import Resource from "terriajs-cesium/Source/Core/Resource";
import filterOutUndefined from "../../Core/filterOutUndefined";
import isDefined from "../../Core/isDefined";
import TerriaError from "../../Core/TerriaError";
import AsyncChartableMixin from "../../ModelMixins/AsyncChartableMixin";
import CatalogMemberMixin from "../../ModelMixins/CatalogMemberMixin";
import TableMixin from "../../ModelMixins/TableMixin";
import UrlMixin from "../../ModelMixins/UrlMixin";
import Csv from "../../Table/Csv";
import TableAutomaticStylesStratum from "../../Table/TableAutomaticStylesStratum";
import SdmxCatalogItemTraits from "../../Traits/SdmxCatalogItemTraits";
import CreateModel from "../CreateModel";
import { BaseModel } from "../Model";
import proxyCatalogItemUrl from "../proxyCatalogItemUrl";
import raiseErrorToUser from "../raiseErrorToUser";
import SelectableDimensions, {
  Dimension,
  SelectableDimension
} from "../SelectableDimensions";
import StratumOrder from "../StratumOrder";
import Terria from "../Terria";
import { SdmxJsonDataflowStratum } from "./SdmxJsonDataflowStratum";
import { sdmxErrorString } from "./SdmxJsonServerStratum";

const automaticTableStylesStratumName = TableAutomaticStylesStratum.stratumName;

export default class SdmxJsonCatalogItem
  extends AsyncChartableMixin(
    TableMixin(UrlMixin(CatalogMemberMixin(CreateModel(SdmxCatalogItemTraits))))
  )
  implements SelectableDimensions {
  static get type() {
    return "sdmx-json";
  }

  private _currentCsvUrl: string | undefined;
  private _currentCsvString: string | undefined;

  @observable private _isLoading = false;

  // This is overriding CatalogMemberMixin until AsyncLoader.isloading is fixed (https://github.com/TerriaJS/terriajs/issues/5233)
  @computed
  get isLoading() {
    return this._isLoading;
  }

  constructor(
    id: string | undefined,
    terria: Terria,
    sourceReference: BaseModel | undefined
  ) {
    super(id, terria, sourceReference);
    this.strata.set(
      TableAutomaticStylesStratum.stratumName,
      new TableAutomaticStylesStratum(this)
    );
  }

  protected async forceLoadMetadata(): Promise<void> {
    // Load SdmxJsonDataflowStratum if needed
    if (!this.strata.has(SdmxJsonDataflowStratum.stratumName)) {
      const stratum = await SdmxJsonDataflowStratum.load(this);
      runInAction(() => {
        this.strata.set(SdmxJsonDataflowStratum.stratumName, stratum);
      });
    }
  }

  get type() {
    return SdmxJsonCatalogItem.type;
  }

  @computed
  get cacheDuration() {
    return super.cacheDuration || "1d";
  }

  @computed
  get canZoomTo() {
    return this.activeTableStyle.latitudeColumn !== undefined;
  }

  /**
   * Map SdmxDataflowStratum.dimensions to selectable dimensions
   */
  @computed
  get sdmxSelectableDimensions(): SelectableDimension[] {
    return this.dimensions.map(dim => {
      return {
        id: dim.id,
        name: dim.name,
        options: dim.options,
        selectedId: dim.selectedId,
        allowUndefined: dim.allowUndefined,
        disable:
          dim.disable ||
          this.columns.find(col => col.name === dim.id)?.type === "region",
        setDimensionValue: (stratumId: string, value: string) => {
          let dimensionTraits = this.dimensions?.find(
            sdmxDim => sdmxDim.id === dim.id
          );
          if (!isDefined(dimensionTraits)) {
            dimensionTraits = this.addObject(stratumId, "dimensions", dim.id!)!;
          }

          dimensionTraits.setTrait(stratumId, "selectedId", value);
          this.forceLoadMapItems(true).then(() => this.forceLoadChartItems());
        }
      };
    });
  }

  @computed
  get selectableDimensions(): SelectableDimension[] {
    return filterOutUndefined([
      ...this.sdmxSelectableDimensions,
      this.regionColumnDimensions,
      this.regionProviderDimensions
    ]);
  }

  /**
   * Returns string compliant with the KeyType defined in the SDMX WADL (period separated dimension values) - dimension order is very important!
   */
  @computed get dataKey(): string {
    const max = this.dimensions.length;
    // We must sort the dimensions by position as traits lose their order across strata
    return (
      this.dimensions
        .slice()
        .sort(
          (a, b) =>
            (isDefined(a.position) ? a.position : max) -
            (isDefined(b.position) ? b.position : max)
        )
        // If a dimension is disabled, use empty string (which is wildcard)
        .map(dim =>
          !dim.disable &&
          this.columns.find(col => col.name === dim.id)?.type !== "region"
            ? dim.selectedId
            : ""
        )
        .join(".")
    );
  }

  /**
   * Returns base URL (from traits), as SdmxJsonCatalogItem will override `url` property with SDMX Data request
   */
  @computed
  get baseUrl(): string | undefined {
    return super.url;
  }

  /**
   * SdmxJsonCatalogItem data request URL, this overrides `traits.url` (if you need `baseUrl` - use `SdmxJsonCatalogItem.baseUrl`)
   */
  @computed
  get url(): string | undefined {
    return isDefined(super.url)
      ? `${super.url}/data/${this.dataflowId}/${this.dataKey}`
      : undefined;
  }

  async _exportData() {
    if (this._currentCsvString) {
      return {
        name: `${this.name || this.uniqueId}.csv`,
        file: new Blob([this._currentCsvString])
      };
    } else {
      return this.url;
    }
  }

  /**
   * Even though this is Sdmx**Json**CatalogItem, we download sdmx-csv.
   */
  private async downloadData(): Promise<string[][] | undefined> {
    if (!this.url) return;
    // FIXME: This is a bad way of handling re-loading the same data
    if (!isDefined(this.regionProviderList) || this._currentCsvUrl === this.url)
      return this.dataColumnMajor;

    this._currentCsvUrl = this.url;

    let columns: string[][] = [];

    try {
      const csvString = await new Resource({
        url: proxyCatalogItemUrl(this, this.url),
        headers: {
          Accept: "application/vnd.sdmx.data+csv; version=1.0.0"
        }
      }).fetch();

      if (!isDefined(csvString)) {
        throw new TerriaError({
          title: i18next.t("models.sdmxCatalogItem.loadDataErrorTitle"),
          message: i18next.t("models.sdmxCatalogItem.loadDataErrorTitle", this)
        });
      }

      this._currentCsvString = csvString;

      columns = await Csv.parseString(csvString, true);
    } catch (error) {
      if (
        error instanceof RequestErrorEvent &&
        typeof error.response === "string"
      ) {
        raiseErrorToUser(
          this.terria,
          new TerriaError({
            message: sdmxErrorString.has(error.statusCode)
              ? `${sdmxErrorString.get(error.statusCode)}: ${error.response}`
              : `${error.response}`,
            title: `Failed to load SDMX data for "${this.name ??
              this.uniqueId}"`
          })
        );
      } else {
        raiseErrorToUser(
          this.terria,
          new TerriaError({
            message: `Failed to load SDMX data for "${this.name ??
              this.uniqueId}"`
          })
        );
      }
    }

    return columns;
  }

  protected async forceLoadTableData(): Promise<string[][]> {
    await this.loadMetadata();

    runInAction(() => (this._isLoading = true));

    const results = await this.downloadData();

    runInAction(() => (this._isLoading = false));

    return results || [];
  }
}

StratumOrder.addLoadStratum(automaticTableStylesStratumName);
