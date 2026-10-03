export interface MainMethods {
  download(options: { onprogress: (count: number) => void }): Promise<string>
  getTitle(prefix: string): Promise<string>
  calculate(a: number, b: number): Promise<number>
}

export interface PreloadMethods {
  pageTitle(): string
  addNumbers(a: number, b: number): number
}

export interface DemoApi {
  download(onprogress: (count: number) => void): Promise<string>
  cancelDownload(): void
  getTitle(prefix: string): Promise<string>
  calculate(a: number, b: number): Promise<number>
}

declare global {
  interface Window { duplexDemo: DemoApi }
}
