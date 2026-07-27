import type { ApiOperation } from './openapi';

/** Generate request code samples for an operation (6 languages). */
export function codeSamples(op: ApiOperation): { label: string; code: string }[] {
  const url = `${op.server}${op.path}`;
  const hasBody = !!op.requestBody;
  const bodyJson = hasBody ? JSON.stringify(op.requestBody!.example, null, 2) : '';
  const auth = op.security === 'bearer';
  const method = op.method;

  const curlLines = [`curl -X ${method} "${url}"`];
  if (auth) curlLines.push(`  -H "Authorization: Bearer $SMILIFY_API_KEY"`);
  if (hasBody) {
    curlLines.push(`  -H "Content-Type: application/json"`);
    curlLines.push(`  -d '${bodyJson.replace(/\n/g, '\n  ')}'`);
  }
  const curl = curlLines.join(' \\\n');

  const pyLines = ['import requests', '', `url = "${url}"`];
  if (auth) pyLines.push('headers = {"Authorization": "Bearer " + API_KEY}');
  if (hasBody) pyLines.push(`payload = ${bodyJson}`);
  pyLines.push(
    `response = requests.${method.toLowerCase()}(url${auth ? ', headers=headers' : ''}${
      hasBody ? ', json=payload' : ''
    })`,
    'print(response.json())'
  );
  const python = pyLines.join('\n');

  const jsHeaders: string[] = [];
  if (auth) jsHeaders.push('    Authorization: `Bearer ${API_KEY}`,');
  if (hasBody) jsHeaders.push('    "Content-Type": "application/json",');
  const jsLines = [`const response = await fetch("${url}", {`, `  method: "${method}",`];
  if (jsHeaders.length) jsLines.push('  headers: {', ...jsHeaders, '  },');
  if (hasBody) jsLines.push(`  body: JSON.stringify(${bodyJson.replace(/\n/g, '\n  ')}),`);
  jsLines.push('});', 'const data = await response.json();');
  const javascript = jsLines.join('\n');

  const tsLines = [
    ...(hasBody ? [`const payload = ${bodyJson.replace(/\n/g, '\n')} as const;`, ''] : []),
    `const response = await fetch("${url}", {`,
    `  method: "${method}",`,
  ];
  if (jsHeaders.length) tsLines.push('  headers: {', ...jsHeaders, '  },');
  if (hasBody) tsLines.push('  body: JSON.stringify(payload),');
  tsLines.push(
    '});',
    'if (!response.ok) throw new Error(`HTTP ${response.status}`);',
    'const data: unknown = await response.json();'
  );
  const typescript = tsLines.join('\n');

  const goLines = [
    'package main',
    '',
    'import (',
    '\t"fmt"',
    '\t"io"',
    '\t"net/http"',
    ...(hasBody ? ['\t"strings"'] : []),
    ')',
    '',
    'func main() {',
  ];
  if (hasBody) {
    goLines.push(`\tbody := strings.NewReader(\`${bodyJson}\`)`);
    goLines.push(`\treq, _ := http.NewRequest("${method}", "${url}", body)`);
    goLines.push('\treq.Header.Set("Content-Type", "application/json")');
  } else {
    goLines.push(`\treq, _ := http.NewRequest("${method}", "${url}", nil)`);
  }
  if (auth) goLines.push('\treq.Header.Set("Authorization", "Bearer "+apiKey)');
  goLines.push(
    '\tres, err := http.DefaultClient.Do(req)',
    '\tif err != nil {',
    '\t\tpanic(err)',
    '\t}',
    '\tdefer res.Body.Close()',
    '\tdata, _ := io.ReadAll(res.Body)',
    '\tfmt.Println(string(data))',
    '}'
  );
  const golang = goLines.join('\n');

  const rustLines = [
    'use reqwest::Client;',
    '',
    '#[tokio::main]',
    'async fn main() -> Result<(), reqwest::Error> {',
    '    let client = Client::new();',
    `    let response = client`,
    `        .${method.toLowerCase()}("${url}")`,
  ];
  if (auth) rustLines.push('        .bearer_auth(api_key)');
  if (hasBody) {
    rustLines.push('        .header("Content-Type", "application/json")');
    rustLines.push(`        .body(r#"${bodyJson}"#)`);
  }
  rustLines.push(
    '        .send()',
    '        .await?;',
    '    println!("{}", response.text().await?);',
    '    Ok(())',
    '}'
  );
  const rust = rustLines.join('\n');

  return [
    { label: 'cURL', code: curl },
    { label: 'Python', code: python },
    { label: 'JavaScript', code: javascript },
    { label: 'TypeScript', code: typescript },
    { label: 'Go', code: golang },
    { label: 'Rust', code: rust },
  ];
}
