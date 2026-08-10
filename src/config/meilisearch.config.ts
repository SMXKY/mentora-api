import { Meilisearch } from "meilisearch";
import { MEILI_HOST, MEILI_MASTER_KEY } from "../utils/enviromentVariablesCheck.util";

const meilisearch = new Meilisearch({
  host: MEILI_HOST,
  apiKey: MEILI_MASTER_KEY,
});

export default meilisearch;
