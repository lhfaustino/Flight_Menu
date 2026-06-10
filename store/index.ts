import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // Usa o localStorage por padrao
import seuSlicedaFeature from './featureSlice';

const rootReducer = combineReducers({
  feature: seuSlicedaFeature,
});

const persistConfig = {
  key: 'root',
  storage,
  // Voce pode escolher quais reducers quer salvar offline:
  whitelist: ['feature'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Necessario para o redux-persist funcionar com TS
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
