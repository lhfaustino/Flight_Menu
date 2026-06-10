import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type DadosFeature = Record<string, unknown>[];

type FeatureState = {
  dados: DadosFeature;
};

const initialState: FeatureState = {
  dados: [],
};

const featureSlice = createSlice({
  name: 'feature',
  initialState,
  reducers: {
    setDadosFeature: (state, action: PayloadAction<DadosFeature>) => {
      state.dados = action.payload;
    },
    limparDadosFeature: (state) => {
      state.dados = [];
    },
  },
});

export const { setDadosFeature, limparDadosFeature } = featureSlice.actions;
export default featureSlice.reducer;
