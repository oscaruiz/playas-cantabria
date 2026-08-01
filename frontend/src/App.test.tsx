import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { installFetchMock, restoreFetch, route } from './test/http/fakeFetch';
import { beachesResponse } from './test/fixtures/beaches';
import { featuredResponse } from './test/fixtures/featured';
import { RUTA_DESTACADAS } from './test/apiRoutes';

// Without this test double the smoke test actually called the Render production
// URL — including from CI. It only passed because the assertion is synchronous.
beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  installFetchMock([
    route(RUTA_DESTACADAS, { json: featuredResponse }),
    route(/\/api\/beaches$/, { json: beachesResponse }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

test('renders without crashing', async () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
  expect(await screen.findAllByText('La Concha')).not.toHaveLength(0);
  await waitFor(() => {
    expect(
      screen.queryByText('Buscando las mejores playas cerca de ti...'),
    ).not.toBeInTheDocument();
  });
});
