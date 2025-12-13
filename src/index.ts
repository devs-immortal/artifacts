import { Hono } from 'hono';
import {
    array,
    boolean,
    nullish,
    number,
    object,
    safeParse,
    string,
} from 'valibot';

const artifactSchema = object({
    id: number(),
    node_id: string(),
    name: string(),
    size_in_bytes: number(),
    url: string(),
    archive_download_url: string(),
    expired: boolean(),
    digest: nullish(string()),
    created_at: nullish(string()),
    updated_at: nullish(string()),
    expires_at: nullish(string()),
    workflow_run: nullish(
        object({
            id: number(),
            repository_id: number(),
            head_repository_id: number(),
            head_branch: string(),
            head_sha: string(),
        }),
    ),
});

const artifactsListSchema = object({
    total_count: number(),
    artifacts: array(artifactSchema),
});

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
    const data = safeParse(artifactsListSchema, await response.json());
    if (!data.success) {
        throw new Error('Invalid artifacts list data structure');
    }

    const { artifacts } = data.output;

    return artifacts.map((artifact) => ({
        name: artifact.workflow_run?.head_sha ?? artifact.id.toString(),
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
