import type { DataSource } from 'typeorm';
import { SkillCategory } from '../../common/enums/skill-category.enum.js';
import { Skill } from '../../modules/skills/entities/skill.entity.js';

interface SkillSeedEntry {
  name: string;
  slug: string;
  category: SkillCategory;
  aliases: string[];
}

/**
 * Catálogo global de skills. Conjunto estático: nomes e slugs são únicos e
 * não devem ser renomeados entre execuções do seed.
 */
export const SKILLS_SEED: ReadonlyArray<SkillSeedEntry> = [
  // Languages
  { name: 'JavaScript', slug: 'javascript', category: SkillCategory.LANGUAGE, aliases: ['JS', 'ECMAScript'] },
  { name: 'TypeScript', slug: 'typescript', category: SkillCategory.LANGUAGE, aliases: ['TS'] },
  { name: 'Python', slug: 'python', category: SkillCategory.LANGUAGE, aliases: ['Py'] },
  { name: 'Java', slug: 'java', category: SkillCategory.LANGUAGE, aliases: [] },
  { name: 'C#', slug: 'c-sharp', category: SkillCategory.LANGUAGE, aliases: ['CSharp', 'DotNet C#'] },
  { name: 'C++', slug: 'cpp', category: SkillCategory.LANGUAGE, aliases: ['CPP'] },
  { name: 'C', slug: 'c-lang', category: SkillCategory.LANGUAGE, aliases: ['ANSI C'] },
  { name: 'Go', slug: 'go', category: SkillCategory.LANGUAGE, aliases: ['Golang'] },
  { name: 'Rust', slug: 'rust', category: SkillCategory.LANGUAGE, aliases: ['RustLang'] },
  { name: 'PHP', slug: 'php', category: SkillCategory.LANGUAGE, aliases: [] },
  { name: 'Ruby', slug: 'ruby', category: SkillCategory.LANGUAGE, aliases: [] },
  { name: 'Swift', slug: 'swift', category: SkillCategory.LANGUAGE, aliases: [] },
  { name: 'Kotlin', slug: 'kotlin', category: SkillCategory.LANGUAGE, aliases: [] },
  { name: 'Scala', slug: 'scala', category: SkillCategory.LANGUAGE, aliases: [] },
  { name: 'SQL', slug: 'sql', category: SkillCategory.LANGUAGE, aliases: ['Structured Query Language'] },
  { name: 'R', slug: 'r', category: SkillCategory.LANGUAGE, aliases: ['R Language'] },
  { name: 'Bash', slug: 'bash', category: SkillCategory.LANGUAGE, aliases: ['Shell', 'sh'] },
  { name: 'HTML', slug: 'html', category: SkillCategory.LANGUAGE, aliases: ['HTML5'] },
  { name: 'CSS', slug: 'css', category: SkillCategory.LANGUAGE, aliases: ['CSS3'] },
  { name: 'Dart', slug: 'dart', category: SkillCategory.LANGUAGE, aliases: [] },
  { name: 'Elixir', slug: 'elixir', category: SkillCategory.LANGUAGE, aliases: [] },
  { name: 'Lua', slug: 'lua', category: SkillCategory.LANGUAGE, aliases: [] },

  // Frameworks
  { name: 'React', slug: 'react', category: SkillCategory.FRAMEWORK, aliases: ['React.js', 'ReactJS'] },
  { name: 'Angular', slug: 'angular', category: SkillCategory.FRAMEWORK, aliases: ['AngularJS'] },
  { name: 'Vue.js', slug: 'vue-js', category: SkillCategory.FRAMEWORK, aliases: ['Vue', 'VueJS'] },
  { name: 'Next.js', slug: 'next-js', category: SkillCategory.FRAMEWORK, aliases: ['NextJS'] },
  { name: 'Node.js', slug: 'node-js', category: SkillCategory.FRAMEWORK, aliases: ['Node', 'NodeJS'] },
  { name: 'Express', slug: 'express', category: SkillCategory.FRAMEWORK, aliases: ['Express.js'] },
  { name: 'NestJS', slug: 'nestjs', category: SkillCategory.FRAMEWORK, aliases: ['Nest'] },
  { name: 'Django', slug: 'django', category: SkillCategory.FRAMEWORK, aliases: [] },
  { name: 'Flask', slug: 'flask', category: SkillCategory.FRAMEWORK, aliases: [] },
  { name: 'FastAPI', slug: 'fastapi', category: SkillCategory.FRAMEWORK, aliases: ['Fast API'] },
  { name: 'Spring Boot', slug: 'spring-boot', category: SkillCategory.FRAMEWORK, aliases: ['Spring'] },
  { name: 'Laravel', slug: 'laravel', category: SkillCategory.FRAMEWORK, aliases: [] },
  { name: 'Rails', slug: 'rails', category: SkillCategory.FRAMEWORK, aliases: ['Ruby on Rails'] },
  { name: '.NET', slug: 'dot-net', category: SkillCategory.FRAMEWORK, aliases: ['DotNet', 'dotnet'] },
  { name: 'ASP.NET Core', slug: 'asp-net-core', category: SkillCategory.FRAMEWORK, aliases: ['ASP.NET', '.NET Core'] },
  { name: 'Flutter', slug: 'flutter', category: SkillCategory.FRAMEWORK, aliases: [] },
  { name: 'React Native', slug: 'react-native', category: SkillCategory.FRAMEWORK, aliases: ['RN'] },
  { name: 'Svelte', slug: 'svelte', category: SkillCategory.FRAMEWORK, aliases: ['SvelteKit'] },
  { name: 'jQuery', slug: 'jquery', category: SkillCategory.FRAMEWORK, aliases: [] },
  { name: 'Tailwind CSS', slug: 'tailwind-css', category: SkillCategory.FRAMEWORK, aliases: ['Tailwind'] },
  { name: 'Gatsby', slug: 'gatsby', category: SkillCategory.FRAMEWORK, aliases: [] },
  { name: 'Nuxt', slug: 'nuxt', category: SkillCategory.FRAMEWORK, aliases: ['Nuxt.js'] },

  // Databases
  { name: 'PostgreSQL', slug: 'postgresql', category: SkillCategory.DATABASE, aliases: ['Postgres'] },
  { name: 'MySQL', slug: 'mysql', category: SkillCategory.DATABASE, aliases: [] },
  { name: 'MariaDB', slug: 'mariadb', category: SkillCategory.DATABASE, aliases: [] },
  { name: 'Microsoft SQL Server', slug: 'sql-server', category: SkillCategory.DATABASE, aliases: ['MSSQL', 'SQL Server'] },
  { name: 'Oracle Database', slug: 'oracle', category: SkillCategory.DATABASE, aliases: ['Oracle'] },
  { name: 'MongoDB', slug: 'mongodb', category: SkillCategory.DATABASE, aliases: ['Mongo'] },
  { name: 'Redis', slug: 'redis', category: SkillCategory.DATABASE, aliases: ['Redis Cache'] },
  { name: 'Elasticsearch', slug: 'elasticsearch', category: SkillCategory.DATABASE, aliases: ['Elastic Search'] },
  { name: 'Apache Cassandra', slug: 'cassandra', category: SkillCategory.DATABASE, aliases: ['Cassandra'] },
  { name: 'Amazon DynamoDB', slug: 'dynamodb', category: SkillCategory.DATABASE, aliases: ['Dynamo DB'] },
  { name: 'SQLite', slug: 'sqlite', category: SkillCategory.DATABASE, aliases: [] },
  { name: 'Neo4j', slug: 'neo4j', category: SkillCategory.DATABASE, aliases: [] },
  { name: 'ClickHouse', slug: 'clickhouse', category: SkillCategory.DATABASE, aliases: [] },
  { name: 'CouchDB', slug: 'couchdb', category: SkillCategory.DATABASE, aliases: [] },

  // Cloud
  { name: 'AWS', slug: 'aws', category: SkillCategory.CLOUD, aliases: ['Amazon Web Services'] },
  { name: 'Microsoft Azure', slug: 'azure', category: SkillCategory.CLOUD, aliases: ['Azure'] },
  { name: 'Google Cloud Platform', slug: 'gcp', category: SkillCategory.CLOUD, aliases: ['GCP', 'Google Cloud'] },
  { name: 'Heroku', slug: 'heroku', category: SkillCategory.CLOUD, aliases: [] },
  { name: 'Cloudflare', slug: 'cloudflare', category: SkillCategory.CLOUD, aliases: [] },
  { name: 'Vercel', slug: 'vercel', category: SkillCategory.CLOUD, aliases: [] },
  { name: 'Netlify', slug: 'netlify', category: SkillCategory.CLOUD, aliases: [] },
  { name: 'DigitalOcean', slug: 'digitalocean', category: SkillCategory.CLOUD, aliases: ['DO'] },
  { name: 'Red Hat OpenShift', slug: 'openshift', category: SkillCategory.CLOUD, aliases: ['OpenShift'] },
  { name: 'AWS CloudFormation', slug: 'cloudformation', category: SkillCategory.CLOUD, aliases: ['CloudFormation'] },
  { name: 'Serverless Framework', slug: 'serverless', category: SkillCategory.CLOUD, aliases: ['Serverless'] },

  // DevOps
  { name: 'Docker', slug: 'docker', category: SkillCategory.DEVOPS, aliases: ['Docker Engine'] },
  { name: 'Kubernetes', slug: 'kubernetes', category: SkillCategory.DEVOPS, aliases: ['K8s'] },
  { name: 'Terraform', slug: 'terraform', category: SkillCategory.DEVOPS, aliases: ['IaC'] },
  { name: 'Ansible', slug: 'ansible', category: SkillCategory.DEVOPS, aliases: [] },
  { name: 'Jenkins', slug: 'jenkins', category: SkillCategory.DEVOPS, aliases: [] },
  { name: 'GitHub Actions', slug: 'github-actions', category: SkillCategory.DEVOPS, aliases: ['GH Actions'] },
  { name: 'GitLab CI', slug: 'gitlab-ci', category: SkillCategory.DEVOPS, aliases: ['GitLab CI/CD'] },
  { name: 'CircleCI', slug: 'circleci', category: SkillCategory.DEVOPS, aliases: [] },
  { name: 'Prometheus', slug: 'prometheus', category: SkillCategory.DEVOPS, aliases: [] },
  { name: 'Grafana', slug: 'grafana', category: SkillCategory.DEVOPS, aliases: [] },
  { name: 'Datadog', slug: 'datadog', category: SkillCategory.DEVOPS, aliases: [] },
  { name: 'Nginx', slug: 'nginx', category: SkillCategory.DEVOPS, aliases: [] },
  { name: 'Helm', slug: 'helm', category: SkillCategory.DEVOPS, aliases: ['Helm Charts'] },
  { name: 'Pulumi', slug: 'pulumi', category: SkillCategory.DEVOPS, aliases: [] },

  // Tools
  { name: 'Git', slug: 'git', category: SkillCategory.TOOL, aliases: ['Git SCM'] },
  { name: 'GitHub', slug: 'github', category: SkillCategory.TOOL, aliases: [] },
  { name: 'GitLab', slug: 'gitlab', category: SkillCategory.TOOL, aliases: [] },
  { name: 'Bitbucket', slug: 'bitbucket', category: SkillCategory.TOOL, aliases: [] },
  { name: 'Jira', slug: 'jira', category: SkillCategory.TOOL, aliases: ['Atlassian Jira'] },
  { name: 'Confluence', slug: 'confluence', category: SkillCategory.TOOL, aliases: [] },
  { name: 'Figma', slug: 'figma', category: SkillCategory.TOOL, aliases: [] },
  { name: 'Postman', slug: 'postman', category: SkillCategory.TOOL, aliases: [] },
  { name: 'Visual Studio Code', slug: 'vscode', category: SkillCategory.TOOL, aliases: ['VS Code'] },
  { name: 'IntelliJ IDEA', slug: 'intellij', category: SkillCategory.TOOL, aliases: ['IntelliJ'] },
  { name: 'Chrome DevTools', slug: 'chrome-devtools', category: SkillCategory.TOOL, aliases: ['DevTools'] },
  { name: 'Swagger', slug: 'swagger', category: SkillCategory.TOOL, aliases: ['OpenAPI'] },
  { name: 'ESLint', slug: 'eslint', category: SkillCategory.TOOL, aliases: [] },
  { name: 'Prettier', slug: 'prettier', category: SkillCategory.TOOL, aliases: [] },
  { name: 'Linux', slug: 'linux', category: SkillCategory.TOOL, aliases: ['GNU/Linux'] },
  { name: 'Windows', slug: 'windows', category: SkillCategory.TOOL, aliases: [] },

  // Methodologies
  { name: 'SCRUM', slug: 'scrum', category: SkillCategory.METHODOLOGY, aliases: ['Scrum'] },
  { name: 'Kanban', slug: 'kanban', category: SkillCategory.METHODOLOGY, aliases: [] },
  { name: 'Agile', slug: 'agile', category: SkillCategory.METHODOLOGY, aliases: ['Agile Development'] },
  { name: 'Extreme Programming', slug: 'extreme-programming', category: SkillCategory.METHODOLOGY, aliases: ['XP'] },
  { name: 'Test-Driven Development', slug: 'tdd', category: SkillCategory.METHODOLOGY, aliases: ['TDD'] },
  { name: 'Behavior-Driven Development', slug: 'bdd', category: SkillCategory.METHODOLOGY, aliases: ['BDD'] },
  { name: 'Domain-Driven Design', slug: 'ddd', category: SkillCategory.METHODOLOGY, aliases: ['DDD'] },
  { name: 'Clean Architecture', slug: 'clean-architecture', category: SkillCategory.METHODOLOGY, aliases: ['Clean Arch'] },
  { name: 'Pair Programming', slug: 'pair-programming', category: SkillCategory.METHODOLOGY, aliases: [] },

  // Soft skills
  { name: 'Communication', slug: 'communication', category: SkillCategory.SOFT_SKILL, aliases: ['Comunicação'] },
  { name: 'Leadership', slug: 'leadership', category: SkillCategory.SOFT_SKILL, aliases: ['Liderança'] },
  { name: 'Teamwork', slug: 'teamwork', category: SkillCategory.SOFT_SKILL, aliases: ['Trabalho em equipe'] },
  { name: 'Problem Solving', slug: 'problem-solving', category: SkillCategory.SOFT_SKILL, aliases: ['Resolução de problemas'] },
  { name: 'Critical Thinking', slug: 'critical-thinking', category: SkillCategory.SOFT_SKILL, aliases: ['Pensamento crítico'] },
  { name: 'Adaptability', slug: 'adaptability', category: SkillCategory.SOFT_SKILL, aliases: ['Adaptabilidade'] },
  { name: 'Time Management', slug: 'time-management', category: SkillCategory.SOFT_SKILL, aliases: ['Gestão de tempo'] },
  { name: 'Mentoring', slug: 'mentoring', category: SkillCategory.SOFT_SKILL, aliases: ['Mentoria'] },
  { name: 'Negotiation', slug: 'negotiation', category: SkillCategory.SOFT_SKILL, aliases: ['Negociação'] },
  { name: 'Empathy', slug: 'empathy', category: SkillCategory.SOFT_SKILL, aliases: ['Empatia'] },
];

/**
 * Aplica o catálogo ao banco de forma idempotente: conflito por `slug`
 * atualiza nome/categoria/aliases, sem criar duplicatas.
 */
export async function seedSkills(dataSource: DataSource): Promise<void> {
  const names = new Set<string>();
  const slugs = new Set<string>();

  for (const entry of SKILLS_SEED) {
    const normalizedName = entry.name.trim().toLowerCase();

    if (names.has(normalizedName)) {
      throw new Error(`Duplicate skill name in catalog seed: ${entry.name}`);
    }
    if (slugs.has(entry.slug)) {
      throw new Error(`Duplicate skill slug in catalog seed: ${entry.slug}`);
    }

    names.add(normalizedName);
    slugs.add(entry.slug);
  }

  await dataSource.getRepository(Skill).upsert([...SKILLS_SEED], ['slug']);
}
