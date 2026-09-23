import { Elysia, t } from "elysia";

import { ErrorEnvelope } from "../../errors";
import { authPlugin } from "../auth";
import {
  CreatedDrawing,
  CreateDrawing,
  DrawingParams,
  DrawingSummary,
  PatchDrawing,
} from "./model";
import { createDrawing, getDrawing, listDrawings, updateDrawing } from "./service";

export const drawings = new Elysia({ prefix: "/drawings", tags: ["Drawings"] })
  .use(authPlugin)
  .post("", async ({ user, body, status }) => status(201, await createDrawing(user.id, body)), {
    auth: true,
    body: CreateDrawing,
    response: { 201: CreatedDrawing, 400: ErrorEnvelope },
    detail: { summary: "Create a Dessin and get a presigned URL to upload its Fichier source" },
  })
  .get("", ({ user }) => listDrawings(user.id), {
    auth: true,
    response: { 200: t.Array(DrawingSummary) },
    detail: { summary: "The caller's Dessins, most recent first" },
  })
  .get("/:id", ({ user, params }) => getDrawing(user.id, params.id), {
    auth: true,
    params: DrawingParams,
    response: { 200: DrawingSummary, 404: ErrorEnvelope },
    detail: { summary: "Résumé of a Dessin" },
  })
  .patch("/:id", ({ user, params, body }) => updateDrawing(user.id, params.id, body), {
    auth: true,
    params: DrawingParams,
    body: PatchDrawing,
    response: { 200: DrawingSummary, 400: ErrorEnvelope, 404: ErrorEnvelope },
    detail: { summary: "Rename a Dessin or change its description" },
  });
