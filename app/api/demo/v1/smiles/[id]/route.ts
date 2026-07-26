import { NextRequest, NextResponse } from 'next/server';
import { getStore, notFound, requireApiKey } from '../../../lib';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireApiKey(req);
  if (denied) return denied;
  const smile = getStore().smiles.find((s) => s.id === params.id);
  if (!smile) return notFound(params.id);
  return NextResponse.json(smile);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireApiKey(req);
  if (denied) return denied;
  const store = getStore();
  const idx = store.smiles.findIndex((s) => s.id === params.id);
  if (idx === -1) return notFound(params.id);
  store.smiles.splice(idx, 1);
  return NextResponse.json({ id: params.id, deleted: true });
}
