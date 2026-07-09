import {
  callOpenApiAction,
  type OpenApiActionResponse,
} from "./openApiService.js";

export const getOpenApiRevenueData = (
  warehouseId: string,
  startDate: string,
  endDate: string,
): Promise<OpenApiActionResponse> =>
  callOpenApiAction(warehouseId, "report_revenue_summary", {
    startDate,
    endDate,
  });

export const getOpenApiShopSummary = async (
  warehouseId: string,
  forDate: string,
): Promise<OpenApiActionResponse> => {
  const response = await getOpenApiRevenueData(warehouseId, forDate, forDate);
  return {
    ...response,
    data: Array.isArray(response.data) ? response.data[0] ?? null : response.data,
  };
};

export const getOpenApiGoodsStatistics = (
  warehouseId: string,
  forDate: string,
): Promise<OpenApiActionResponse> =>
  callOpenApiAction(warehouseId, "report_sell_statistics_bygoodstype", {
    StartDate: forDate,
    EndDate: forDate,
    GoodsName: "",
    GoodsSellSource: "",
    GoodsTypeNameContent: "",
  });
