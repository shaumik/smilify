import type { ApiOperation } from './openapi';

/** Generate request code samples (curl / Python / JavaScript) for an operation. */
export function codeSamples(op: ApiOperation): { label: string; code: string }[] {
  const url = `${op.server}${op.path}`.replace(/\{(\w+)\}/g, '{$1}');
  const hasBody = !!op.requestBody;
  const bodyJson = hasBody ? JSON.stringify(op.requestBody!.example, null, 2) : '';
  const authHeader = op.security === 'bearer';

  const curlLines = [`curl -X ${op.method} "${url}"`];
  if (authHeader) curlLines.push(`  -H "Authorization: Bearer $SMILIFY_API_KEY"`);
  if (hasBody) {
    curlLines.push(`  -H "Content-Type: application/json"`);
    curlLines.push(`  -d '${bodyJson.replace(/\n/g, '\n  ')}'`);
  }
  const curl = curlLines.join(' \\\n');

  const pyLines = [
    'import requests',
    '',
    `url = "${url}"`,
  ];
  if (authHeader) pyLines.push('headers = {"Authorization": "Bearer " + API_KEY}');
  if (hasBody) pyLines.push(`payload = ${bodyJson}`);
  pyLines.push(
    `response = requests.${op.method.toLowerCase()}(url${authHeader ? ', headers=headers' : ''}${
      hasBody ? ', json=payload' : ''
    })`,
    'print(response.json())'
  );
  const python = pyLines.join('\n');

  const jsLines = [`const response = await fetch("${url}", {`, `  method: "${op.method}",`];
  const jsHeaders: string[] = [];
  if (authHeader) jsHeaders.push('    Authorization: `Bearer ${API_KEY}`,');
  if (hasBody) jsHeaders.push('    "Content-Type": "application/json",');
  if (jsHeaders.length) jsLines.push('  headers: {', ...jsHeaders, '  },');
  if (hasBody) jsLines.push(`  body: JSON.stringify(${bodyJson.replace(/\n/g, '\n  ')}),`);
  jsLines.push('});', 'const data = await response.json();');
  const javascript = jsLines.join('\n');

  return [
    { label: 'cURL', code: curl },
    { label: 'Python', code: python },
    { label: 'JavaScript', code: javascript },
  ];
}
