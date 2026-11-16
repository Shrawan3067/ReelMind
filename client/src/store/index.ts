import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import studioReducer from './studioSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    studio: studioReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

