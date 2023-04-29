import { createAction } from "@reduxjs/toolkit";
export const updateSearchResult = createAction("farming/updateSearchResult");
export const updateNewSearchResult = createAction("farming/updateNewSearchResult");
export const updateFilterResult = createAction("farming/updateFilterResult");
export const updateNewFilterResult = createAction("farming/updateNewFilterResult");
export const clearSearchResult = createAction("farming/clearSearchResult");
export const updateYieldFarmDetails = createAction("farming/updateYieldFarmDetails");
export const updateProductFarmDetails = createAction("farming/updateProductFarmDetails");
export const updateSelectedField = createAction("farming/updateSelectedField");
export const clearAllFarms = createAction("farming/clearAllFarms");
