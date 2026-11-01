/**
 * SkillBridge AI - Skill Domain Detection Utility
 * Classifies skill names and user query contexts into functional technical domains.
 */

export type SkillDomain =
  | 'ml_ai'
  | 'vector_ai'
  | 'database'
  | 'devops_cloud'
  | 'security'
  | 'frontend'
  | 'backend_api'
  | 'algorithms'
  | 'general_engineering';

export function detectSkillDomain(skillName: string, message: string = ''): SkillDomain {
  const combined = `${skillName} ${message}`.toLowerCase();
  if (
    combined.includes('pytorch') || combined.includes('torch') || combined.includes('tensorflow') ||
    combined.includes('keras') || combined.includes('scikit-learn') || combined.includes('sklearn') ||
    combined.includes('deep learning') || combined.includes('neural network') || combined.includes('transformer') ||
    combined.includes('huggingface') || combined.includes('llm') || combined.includes('autograd') ||
    combined.includes('dataloader') || combined.includes('tensor') || combined.includes('gradient descent') ||
    combined.includes('backprop') || combined.includes('cnn') || combined.includes('rnn') ||
    combined.includes('lstm') || combined.includes('cuda') || combined.includes('loss.backward') ||
    combined.includes('nn.module') || combined.includes('optimizer') || combined.includes('crossentropyloss') ||
    combined.includes('adamw') || combined.includes('machine learning') || combined.includes('ml/ai')
  ) {
    return 'ml_ai';
  }
  if (combined.includes('vector') || combined.includes('embedding') || combined.includes('hnsw') || combined.includes('cosine') || combined.includes('pgvector') || combined.includes('rag') || combined.includes('nearest neighbor') || combined.includes('faiss')) {
    return 'vector_ai';
  }
  if (combined.includes('postgres') || combined.includes('postgresql') || combined.includes('mysql') || combined.includes('sqlite') || combined.includes('redis') || combined.includes('mongodb') || combined.includes('sql') || combined.includes('btree') || combined.includes('b-tree') || combined.includes('wal') || combined.includes('acid') || combined.includes('query planner')) {
    return 'database';
  }
  if (combined.includes('docker') || combined.includes('container') || combined.includes('kubernetes') || combined.includes('k8s') || combined.includes('aws') || combined.includes('s3') || combined.includes('sqs') || combined.includes('lambda') || combined.includes('ci/cd') || combined.includes('terraform') || combined.includes('devops')) {
    return 'devops_cloud';
  }
  if (
    combined.includes('security') || combined.includes('audit') || combined.includes('pentest') ||
    combined.includes('penetration') || combined.includes('vulnerability') || combined.includes('siem') ||
    combined.includes('firewall') || combined.includes('cryptography') || combined.includes('cipher') ||
    combined.includes('jwt') || combined.includes('oauth') || combined.includes('token') ||
    combined.includes('auth') || combined.includes('rbac') || combined.includes('secret key') ||
    combined.includes('csrf') || combined.includes('xss') || combined.includes('cors') || combined.includes('owasp')
  ) {
    return 'security';
  }
  if (combined.includes('react') || combined.includes('vue') || combined.includes('angular') || combined.includes('typescript') || combined.includes('javascript') || combined.includes('css') || combined.includes('tailwind') || combined.includes('next.js') || combined.includes('virtual dom') || combined.includes('frontend')) {
    return 'frontend';
  }
  if (combined.includes('api') || combined.includes('rest') || combined.includes('django') || combined.includes('drf') || combined.includes('fastapi') || combined.includes('flask') || combined.includes('express') || combined.includes('node') || combined.includes('endpoint') || combined.includes('serializer') || combined.includes('viewset') || combined.includes('middleware')) {
    return 'backend_api';
  }
  if (combined.includes('algorithm') || combined.includes('data structure') || combined.includes('tree') || combined.includes('graph') || combined.includes('binary search') || combined.includes('sorting') || combined.includes('dynamic programming') || combined.includes('recursion') || combined.includes('big-o')) {
    return 'algorithms';
  }
  return 'general_engineering';
}
