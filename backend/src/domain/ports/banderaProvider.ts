export interface BanderaProvider {
  getBandera(playaId: string): Promise<string>;
}
