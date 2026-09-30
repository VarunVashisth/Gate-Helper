import type { SyllabusTopic } from "../api/client";

export type TopicPath = number[];

export function flattenTopics(topics: SyllabusTopic[]) {
  const rows: Array<{ topic: SyllabusTopic; path: TopicPath }> = [];
  const visit = (nodes: SyllabusTopic[], parentPath: TopicPath) => {
    nodes.forEach((topic, index) => {
      const path = [...parentPath, index];
      rows.push({ topic, path });
      visit(topic.subtopics, path);
    });
  };
  visit(topics, []);
  return rows;
}

function updateListAtPath(
  topics: SyllabusTopic[],
  parentPath: TopicPath,
  update: (siblings: SyllabusTopic[]) => SyllabusTopic[],
): SyllabusTopic[] {
  if (parentPath.length === 0) return update(topics);
  const [index, ...remainder] = parentPath;
  return topics.map((topic, topicIndex) => topicIndex === index
    ? { ...topic, subtopics: updateListAtPath(topic.subtopics, remainder, update) }
    : topic);
}

export function renameTopic(topics: SyllabusTopic[], path: TopicPath, name: string) {
  const parentPath = path.slice(0, -1);
  const index = path.at(-1)!;
  return updateListAtPath(topics, parentPath, (siblings) => siblings.map((topic, siblingIndex) =>
    siblingIndex === index ? { ...topic, name } : topic));
}

export function addRootTopic(topics: SyllabusTopic[]) {
  return [...topics, createTopic("New topic")];
}

export function addChildTopic(topics: SyllabusTopic[], path: TopicPath) {
  const parentPath = path.slice(0, -1);
  const index = path.at(-1)!;
  return updateListAtPath(topics, parentPath, (siblings) => siblings.map((topic, siblingIndex) =>
    siblingIndex === index
      ? { ...topic, subtopics: [...topic.subtopics, createTopic("New subtopic")] }
      : topic));
}

export function removeTopic(topics: SyllabusTopic[], path: TopicPath) {
  const parentPath = path.slice(0, -1);
  const index = path.at(-1)!;
  return updateListAtPath(topics, parentPath, (siblings) => siblings.filter((_, siblingIndex) => siblingIndex !== index));
}

export function moveTopic(topics: SyllabusTopic[], path: TopicPath, offset: -1 | 1) {
  const parentPath = path.slice(0, -1);
  const index = path.at(-1)!;
  return updateListAtPath(topics, parentPath, (siblings) => {
    const destination = index + offset;
    if (destination < 0 || destination >= siblings.length) return siblings;
    const next = [...siblings];
    [next[index], next[destination]] = [next[destination], next[index]];
    return next;
  });
}

export function indentTopic(topics: SyllabusTopic[], path: TopicPath) {
  const parentPath = path.slice(0, -1);
  const index = path.at(-1)!;
  if (index === 0) return topics;
  return updateListAtPath(topics, parentPath, (siblings) => {
    const target = siblings[index];
    const previous = siblings[index - 1];
    const next = [...siblings];
    next[index - 1] = { ...previous, subtopics: [...previous.subtopics, target] };
    next.splice(index, 1);
    return next;
  });
}

export function outdentTopic(topics: SyllabusTopic[], path: TopicPath) {
  if (path.length < 2) return topics;
  const grandparentPath = path.slice(0, -2);
  const parentIndex = path.at(-2)!;
  const childIndex = path.at(-1)!;
  return updateListAtPath(topics, grandparentPath, (siblings) => {
    const parent = siblings[parentIndex];
    const target = parent.subtopics[childIndex];
    const updatedParent = {
      ...parent,
      subtopics: parent.subtopics.filter((_, index) => index !== childIndex),
    };
    const next = [...siblings];
    next[parentIndex] = updatedParent;
    next.splice(parentIndex + 1, 0, target);
    return next;
  });
}

export function countTopics(topics: SyllabusTopic[]): number {
  return topics.reduce((total, topic) => total + 1 + countTopics(topic.subtopics), 0);
}

export function countLeafTopics(topics: SyllabusTopic[]): number {
  return topics.reduce(
    (total, topic) => total + (topic.subtopics.length ? countLeafTopics(topic.subtopics) : 1),
    0,
  );
}

function createTopic(name: string): SyllabusTopic {
  return { id: crypto.randomUUID(), name, completed: false, subtopics: [] };
}

