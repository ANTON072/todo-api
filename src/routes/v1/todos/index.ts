import { createHono } from "../../../lib/hono";
import { requireAuth } from "../../../middleware/auth";
import { createTodoRoute } from "./create";
import { detailTodoRoute } from "./detail";
import { listTodosRoute } from "./list";
import { removeTodoRoute } from "./remove";
import { updateTodoRoute } from "./update";

const app = createHono();

app.use("*", requireAuth);

// Static paths registered before dynamic to avoid parameter capture
app.route("/", listTodosRoute);
app.route("/", createTodoRoute);
app.route("/", detailTodoRoute);
app.route("/", updateTodoRoute);
app.route("/", removeTodoRoute);

export const todosRouter = app;
