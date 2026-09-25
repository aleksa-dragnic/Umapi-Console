/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The API's origin, with no path: the generated paths already begin with
   * `/api/v1`. Unset, the console talks to the deployed instance.
   */
  readonly VITE_API_BASE_URL?: string;
}
