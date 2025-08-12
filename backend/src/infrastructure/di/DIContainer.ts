type Factory<T = any> = (container: DIContainer) => T;
type Singleton<T = any> = { instance: T };

export class DIContainer {
  private factories = new Map<string, Factory>();
  private singletons = new Map<string, Singleton>();

  /**
   * Register a factory function for a dependency
   */
  register<T>(key: string, factory: Factory<T>): void {
    this.factories.set(key, factory);
  }

  /**
   * Register a singleton instance (created once and reused)
   */
  registerSingleton<T>(key: string, factory: Factory<T>): void {
    this.register(key, (container) => {
      if (!this.singletons.has(key)) {
        const instance = factory(container);
        this.singletons.set(key, { instance });
      }
      return this.singletons.get(key)!.instance;
    });
  }

  /**
   * Register an instance directly (already created)
   */
  registerInstance<T>(key: string, instance: T): void {
    this.singletons.set(key, { instance });
    this.register(key, () => instance);
  }

  /**
   * Get a dependency from the container with proper typing
   */
  get<T = any>(key: string): T {
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Dependency '${key}' not found in container`);
    }
    return factory(this) as T;
  }

  /**
   * Check if a dependency is registered
   */
  has(key: string): boolean {
    return this.factories.has(key);
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.factories.clear();
    this.singletons.clear();
  }
}
