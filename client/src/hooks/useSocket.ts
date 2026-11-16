import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { getAuthToken } from '../services/api';
import { addToast } from '../store/studioSlice';

export function useSocket() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAuthToken();
    if (!token) return;

    const socket: Socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('job:progress', () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    });

    socket.on('job:completed', () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      dispatch(addToast({ type: 'success', message: 'Media processing & AI indexing completed!' }));
    });

    socket.on('job:failed', (payload: { error?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
      dispatch(
        addToast({
          type: 'error',
          message: payload?.error ? `Processing failed: ${payload.error}` : 'Media processing failed.'
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, queryClient, dispatch]);
}

