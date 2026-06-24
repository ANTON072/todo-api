import { router } from "../src/routes/index";

const res = await router.fetch(
  new Request("http://localhost/api/docs/openapi.json"),
);
const json = await res.json();
process.stdout.write(JSON.stringify(json, null, 2) + "\n");
