import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { installFetchMock, restoreFetch, route } from './test/http/fakeFetch';
import { beachesResponse } from './test/fixtures/beaches';
import { featuredResponse } from './test/fixtures/featured';

// Sin este doble el smoke test llamaba de verdad a la URL de producción de
// Render — desde CI incluido. Pasaba solo porque la aserción es síncrona.
beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
  installFetchMock([
    route('/api/beaches/featured', { json: featuredResponse }),
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
