import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PermissionSchema } from "@/protocol";
import { checkPermission, filterInputs } from "@/marketplace/permissions";
import { assertDevRoutes } from "@/lib/dev-guard";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  permission: PermissionSchema,
  envelope: z.array(PermissionSchema),
  inputs: z.record(z.string(), z.unknown()).optional(),
  grants: z.array(PermissionSchema).optional(),
});

export async function POST(req: NextRequest) {
  const guard = assertDevRoutes();
  if (guard) return guard;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.message } },
      { status: 400 }
    );
  }
  const { permission, envelope, inputs, grants } = parsed.data;
  return NextResponse.json({
    check: checkPermission({ permission, envelope }),
    filtered: filterInputs(inputs ?? {}, grants ?? envelope),
  });
}
