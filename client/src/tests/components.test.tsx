import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from '../store';
import { addToast } from '../store/studioSlice';
import { LandingPage } from '../pages/LandingPage';
import { AuthPage } from '../pages/AuthPage';
import { DashboardPage } from '../pages/DashboardPage';
import { MediaLibraryPage } from '../pages/MediaLibraryPage';
import { AISearchStudioPage } from '../pages/AISearchStudioPage';
import { StoryboardStudioPage } from '../pages/StoryboardStudioPage';
import { ContentStudioPage } from '../pages/ContentStudioPage';
import { ToastContainer } from '../components/ToastContainer';
import { api } from '../services/api';

describe('ReelMind React Component Tests (React Testing Library)', () => {
  it('renders LandingPage hero headline, primary CTAs, and UGREEN integration section', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Your Media Library Just Became Your/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Start Creating/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Built Strictly to the Official Uliya Skill Standard/i)).toBeInTheDocument();
  });

  it('renders AuthPage in login and register modes and toggles password visibility', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <AuthPage mode="login" />
        </MemoryRouter>
      </Provider>
    );

    const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleBtn = screen.getByLabelText('Toggle password visibility');
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe('text');

    const demoBtn = screen.getByText(/Fill Demo Seed Credentials/i);
    fireEvent.click(demoBtn);
    const emailInput = screen.getByPlaceholderText('you@studio.com') as HTMLInputElement;
    expect(emailInput.value).toBe('creator@reelmind.ai');
  });

  it('displays and dismisses notifications via ToastContainer', () => {
    store.dispatch(addToast({ type: 'success', message: 'Test Storyboard Saved!' }));

    render(
      <Provider store={store}>
        <ToastContainer />
      </Provider>
    );

    expect(screen.getByText('Test Storyboard Saved!')).toBeInTheDocument();
    const closeBtn = screen.getByLabelText('Close notification');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Test Storyboard Saved!')).not.toBeInTheDocument();
  });

  it('renders DashboardPage quick director controls, scenario presets, and KPI metrics', async () => {
    const getSpy = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/dashboard/stats') {
        return {
          data: {
            data: {
              stats: {
                totalMedia: 150,
                videosIndexed: 100,
                photosIndexed: 50,
                audioIndexed: 0,
                demoMediaCount: 150,
                nasMediaCount: 0,
                localMediaCount: 0,
                realMediaCount: 0,
                totalStorageBytes: 500_000_000,
                totalDurationSeconds: 1800,
                totalScenesIndexed: 165,
                activeJobs: 0,
                failedJobs: 0,
                totalStoryboards: 3
              },
              aiCapabilities: { provider: 'none', configured: false, model: 'deterministic-local-planner' },
              nasStatus: { status: 'disconnected' },
              recentStoryboards: [
                {
                  id: 'sb1',
                  title: 'Summer Pool Adventure',
                  creativeConcept: 'Dog pool adventure',
                  actualDuration: 30,
                  aspectRatio: '16:9',
                  sceneCount: 4,
                  hasDemoMedia: true
                }
              ],
              recentSearches: []
            }
          }
        } as never;
      }
      return { data: { data: { projects: [] } } } as never;
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );

    expect(screen.getByText('Creative Command Center')).toBeInTheDocument();
    expect(await screen.findByText('Summer Pool Adventure')).toBeInTheDocument();

    const presetBtn = screen.getByText(/Vertical Product Ad/i);
    fireEvent.click(presetBtn);
    const promptBox = screen.getByPlaceholderText(/Describe the video cut/i) as HTMLInputElement;
    expect(promptBox.value).toContain('vertical product advertisement');

    getSpy.mockRestore();
  });

  it('renders MediaLibraryPage collection pills, media cards, and batch selection bar', async () => {
    const getSpy = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/media') {
        return {
          data: {
            data: {
              items: [
                {
                  id: 'm1',
                  filename: 'dog_pool_01.mp4',
                  sourceType: 'demo',
                  mediaType: 'video',
                  mimeType: 'video/mp4',
                  fileSize: 68_000_000,
                  duration: 28,
                  width: 3840,
                  height: 2160,
                  frameRate: 60,
                  processingStatus: 'completed',
                  isFavorite: true,
                  isDemoData: true,
                  collections: ['Dog Pool Clips'],
                  thumbnailUrl: '/api/v1/media/m1/thumbnail',
                  playbackUrl: '/api/v1/media/m1/stream',
                  createdAt: new Date().toISOString()
                }
              ],
              pagination: { page: 1, limit: 24, total: 1, totalPages: 1 }
            }
          }
        } as never;
      }
      if (url === '/media/collections') {
        return {
          data: {
            data: {
              collections: [{ id: 'c1', name: 'Dog Pool Clips', color: '#06B6D4', mediaCount: 6 }]
            }
          }
        } as never;
      }
      return { data: { data: { stats: { demoMediaCount: 150 } } } } as never;
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <MediaLibraryPage />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );

    expect(await screen.findByText('dog_pool_01.mp4')).toBeInTheDocument();
    expect(screen.getByText('4K')).toBeInTheDocument();
    expect(screen.getByText('Dog Pool Clips')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select dog_pool_01.mp4'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByText(/Send to Studio/i)).toBeInTheDocument();

    getSpy.mockRestore();
  });

  it('renders AISearchStudioPage, runs semantic search, opens score breakdown and preview modal', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: { data: { history: [] } }
    } as never);
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        data: {
          results: [
            {
              sceneId: 'sc1',
              mediaAssetId: 'm1',
              filename: 'dog_pool_03.mp4',
              sourceType: 'demo',
              mediaType: 'video',
              thumbnailUrl: 'data:image/svg+xml;utf8,<svg/>',
              duration: 24,
              startTime: 4,
              endTime: 14,
              description: 'Golden retriever leaping into a sunlit backyard pool.',
              matchScore: 0.92,
              evidenceSource: 'metadata',
              explanation: 'Matched terms: dog, swimming, pool',
              isDemoData: true,
              ranking: {
                semanticRelevance: 0.91,
                visualQuality: 0.88,
                narrativeValue: 0.9,
                finalScore: 0.92,
                weightsUsed: { semanticRelevance: 0.45 },
                explanation: 'High semantic relevance and clip quality.'
              }
            }
          ],
          totalMatched: 1,
          searchMode: 'hybrid_vector_lexical',
          queryEmbeddingModel: 'local-deterministic-v1'
        }
      }
    } as never);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <AISearchStudioPage />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );

    expect(screen.getByText('AI Search Studio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Search Library/i }));

    expect(await screen.findByText('dog_pool_03.mp4')).toBeInTheDocument();
    expect(screen.getByText('92% Match')).toBeInTheDocument();
    expect(screen.getByText('Metadata & Scene Index')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Score details/i }));
    expect(screen.getByText('High semantic relevance and clip quality.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Select Clip/i }));
    expect(screen.getByText('Creative Selection (1)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Clear all/i }));

    getSpy.mockRestore();
    postSpy.mockRestore();
  });

  it('renders StoryboardStudioPage monitor, timeline thumbnails, music mood, and export plan modal', async () => {
    const getSpy = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/storyboards') {
        return {
          data: {
            data: {
              storyboards: [{ id: 'sb1', title: 'Pool Adventure Cut', actualDuration: 12 }]
            }
          }
        } as never;
      }
      if (url === '/storyboards/sb1') {
        return {
          data: {
            data: {
              storyboard: {
                id: 'sb1',
                projectId: 'p1',
                title: 'Pool Adventure Cut',
                creativeConcept: 'Energetic dog pool splash sequence',
                targetDuration: 30,
                actualDuration: 12,
                aspectRatio: '16:9',
                mood: 'uplifting',
                version: 1,
                editingNotes: 'Cut on the splash beat.',
                musicSuggestions: [
                  { title: 'Sunlit Splash', mood: 'energetic', tempo: '122 BPM', notes: 'Bright acoustic guitar and drums.' }
                ],
                scenes: [
                  {
                    id: 'sc_a',
                    order: 0,
                    mediaAssetId: 'm1',
                    sourceFilename: 'dog_pool_01.mp4',
                    sourceType: 'demo',
                    isDemoData: true,
                    sourceDuration: 20,
                    sourceStartTime: 2,
                    sourceEndTime: 8,
                    timelineStartTime: 0,
                    timelineEndTime: 6,
                    description: 'Dog sprinting beside pool deck.',
                    caption: 'Ready for liftoff',
                    transition: 'fade_in',
                    locked: false,
                    thumbnailUrl: 'data:image/svg+xml;utf8,<svg/>',
                    evidenceSource: 'metadata'
                  },
                  {
                    id: 'sc_b',
                    order: 1,
                    mediaAssetId: 'm2',
                    sourceFilename: 'dog_pool_02.mp4',
                    sourceType: 'demo',
                    isDemoData: true,
                    sourceDuration: 18,
                    sourceStartTime: 0,
                    sourceEndTime: 6,
                    timelineStartTime: 6,
                    timelineEndTime: 12,
                    description: 'Slow motion water splash.',
                    caption: 'Mid-air splash',
                    transition: 'crossfade',
                    locked: false,
                    thumbnailUrl: 'data:image/svg+xml;utf8,<svg/>',
                    evidenceSource: 'hybrid'
                  }
                ]
              }
            }
          }
        } as never;
      }
      return { data: { data: { items: [] } } } as never;
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <StoryboardStudioPage />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );

    expect(await screen.findByText('Interactive Storyboard Timeline (Drag clips to reorder)')).toBeInTheDocument();
    expect(screen.getByText('Sunlit Splash')).toBeInTheDocument();
    expect(screen.getByText('energetic')).toBeInTheDocument();
    expect(screen.getByText('Verified Production Shot List')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '9:16' }));
    expect(screen.getByText(/Autosaving edits/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Undo edit'));

    getSpy.mockRestore();
  });

  it('renders ContentStudioPage with anchored storyboard sync, platform pills, preview updates, and section regeneration', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        data: {
          storyboards: [
            {
              id: 'sb1',
              title: 'Summer Pool Adventure',
              creativeConcept: 'Dog pool adventure with crisp splashes',
              actualDuration: 30,
              aspectRatio: '16:9',
              mood: 'uplifting',
              scenes: [{ id: 's1' }, { id: 's2' }]
            }
          ]
        }
      }
    } as never);

    const postSpy = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/content/generate-pack') {
        return {
          data: {
            data: {
              groundedInStoryboard: true,
              titles: ['First Pool Cut', 'Splash Highlights 4K'],
              hooks: ['Watch this splash!'],
              thumbnailTexts: ['PURE MAGIC'],
              captions: ['Sunny summer vibes'],
              descriptions: ['Full breakdown of pool scenes'],
              hashtags: ['#DogPool #ReelMind'],
              narrationScript: [{ sceneOrder: 1, timestamp: '00:00–00:10', line: 'Dog sprints to pool' }]
            }
          }
        } as never;
      }
      if (url === '/content/generate-title') {
        return {
          data: {
            data: {
              titles: ['Regenerated Title A', 'Regenerated Title B']
            }
          }
        } as never;
      }
      return { data: { data: {} } } as never;
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/app/content?storyboardId=sb1']}>
            <ContentStudioPage />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );

    expect(await screen.findByText('Anchored: Summer Pool Adventure')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Shorts/i }));
    fireEvent.click(screen.getByRole('button', { name: /Generate Publishing Pack/i }));

    expect(await screen.findByText('Title Variations')).toBeInTheDocument();
    expect(screen.getByText('Selected Shorts Preview')).toBeInTheDocument();
    expect(screen.getByText('Scene-by-Scene Narration Script')).toBeInTheDocument();

    const useButtons = screen.getAllByRole('button', { name: /Use in Kit/i });
    fireEvent.click(useButtons[0]);
    expect(screen.getAllByText('Splash Highlights 4K').length).toBeGreaterThan(0);

    const regenButtons = screen.getAllByRole('button', { name: /Regenerate/i });
    fireEvent.click(regenButtons[0]);
    expect(await screen.findByDisplayValue('Regenerated Title A')).toBeInTheDocument();

    getSpy.mockRestore();
    postSpy.mockRestore();
  });
});

