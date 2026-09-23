import { Elysia, t } from "elysia";

import { ErrorEnvelope } from "../../errors";
import { authPlugin } from "../auth";
import {
  CreatedDrawing,
  CreateDrawing,
  DrawingDetail,
  DrawingParams,
  DrawingSummary,
  PatchDrawing,
} from "./model";
import { completeUpload, createDrawing, getDrawing, listDrawings, updateDrawing } from "./service";

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
    response: { 200: DrawingDetail, 404: ErrorEnvelope },
    detail: {
      summary: "Résumé of a Dessin, with short-lived links to its Dessin parsé and Fichier source",
    },
  })
  .post(
    "/:id/complete",
    async ({ user, params, status }) => status(202, await completeUpload(user.id, params.id)),
    {
      auth: true,
      params: DrawingParams,
      response: {
        202: DrawingSummary,
        404: ErrorEnvelope,
        409: ErrorEnvelope,
        413: ErrorEnvelope,
      },
      detail: {
        summary: "Signal the end of the upload: the Fichier source is checked, then queued",
        description:
          "409 `SOURCE_FILE_MISSING` when nothing was uploaded, 413 `SOURCE_FILE_TOO_LARGE` over the size limit, 409 `NO_PENDING_UPLOAD` when the upload is already completed.",
      },
    },
  )
  .patch("/:id", ({ user, params, body }) => updateDrawing(user.id, params.id, body), {
    auth: true,
    params: DrawingParams,
    body: PatchDrawing,
    response: { 200: DrawingSummary, 400: ErrorEnvelope, 404: ErrorEnvelope },
    detail: { summary: "Rename a Dessin or change its description" },
  });
