import { DIContainer } from './DIContainer';
import { configureDependencies, DependencyOverrides } from './dependencies';

/**
 * Factory function to create a pre-configured DI Container
 */
export function createContainer(overrides: DependencyOverrides): DIContainer {
  const container = new DIContainer();
  configureDependencies(container, overrides);
  return container;
}
