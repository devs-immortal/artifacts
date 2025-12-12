import { Hono } from 'hono';

const fetchGithub = async (url: string, env: Env) => {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${env.GITHUB_PAT}`,
            'User-Agent': 'Devs-Immortal-Artifacts-Viewer',
        },
    });
    return response;
};

const fetchArtifactZip = async (repo: string, artifactId: string, env: Env) => {
    const apiUrl = `https://api.github.com/repos/devs-immortal/${repo}/actions/artifacts/${artifactId}/zip`;
    const response = await fetchGithub(apiUrl, env);
    if (!response.ok) {
        throw new Error(`Failed to fetch artifact zip: ${response.statusText}`);
    }
    return response;
};

const fetchArtifactsList = async (repo: string, env: Env) => {
    const apiUrl = `https://api.github.com/repos/devs-immortal/${repo}/actions/artifacts`;
    const response = await fetchGithub(apiUrl, env);
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    return data.artifacts.map((artifact: Record<string, unknown>) => ({
        name: artifact.workflow_run?.head_sha || artifact.name,
        url: `/artifact/${repo}/${artifact.id}`,
        created: artifact.created_at,
    }));
};

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
    if (err instanceof Error) {
        return c.json({ error: err.message, status: 500 }, 500);
    }
    return c.json({ error: 'Unknown error', status: 500 }, 500);
});

app.get('/artifact/:repo/:artifactId', async (c) => {
    const { repo, artifactId } = c.req.param();
    const response = await fetchArtifactZip(repo, artifactId, c.env);
    return new Response(response.body, {
        headers: {
            'Content-Disposition': 'attachment',
            'Content-Type': 'application/zip',
        },
    });
});

app.get('/artifacts/:repo', async (c) => {
    const { repo } = c.req.param();
    const artifacts = await fetchArtifactsList(repo, c.env);
    return c.json(artifacts);
});

app.get('/favicon.ico', (c) => {
    return Response.redirect('https://immortaldevs.net/favicon.ico', 301);
});

app.all('*', (c) => {
    return c.env.ASSETS.fetch(new URL('/', c.req.url));
});

export default app;
