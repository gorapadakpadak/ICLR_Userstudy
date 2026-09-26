// Sequential weighted sampling without replacement, followed by a random display order.
export function sampleCaseIds(cases, count, weights = {}, random = Math.random, constraint = null) {
  if (!Number.isInteger(count) || count < 0 || count > cases.length) throw new Error('Invalid case count.');
  const pool = cases.map(item => ({ id:item.id, weight:weights[item.id] ?? 1 }));
  if (new Set(pool.map(item=>item.id)).size !== pool.length) throw new Error('Duplicate case IDs.');
  if (pool.some(item=>!Number.isFinite(item.weight) || item.weight<=0)) throw new Error('Case weights must be finite and positive.');
  const group = new Set(constraint?.caseIds || []);
  const maximum = constraint?.maxCount ?? count;
  const repeatWeightMultiplier = constraint?.repeatWeightMultiplier ?? 1;
  if (!Number.isInteger(maximum) || maximum<0) throw new Error('Invalid group limit.');
  if (!Number.isFinite(repeatWeightMultiplier) || repeatWeightMultiplier<=0) throw new Error('Invalid repeat-group multiplier.');
  if (pool.filter(item=>!group.has(item.id)).length + Math.min(maximum,pool.filter(item=>group.has(item.id)).length) < count) throw new Error('Not enough cases under the group limit.');
  const selected=[];
  while (selected.length<count) {
    const selectedFromGroup = selected.filter(id=>group.has(id)).length;
    const atLimit = selectedFromGroup >= maximum;
    const eligible = pool.filter(item=>!atLimit || !group.has(item.id));
    const effectiveWeight = item => item.weight * (selectedFromGroup>0 && group.has(item.id) ? repeatWeightMultiplier : 1);
    let ticket=random()*eligible.reduce((sum,item)=>sum+effectiveWeight(item),0);
    let index=0;
    while (index<eligible.length-1 && ticket>=effectiveWeight(eligible[index])) ticket-=effectiveWeight(eligible[index++]);
    const chosen=eligible[index].id;
    pool.splice(pool.findIndex(item=>item.id===chosen),1);
    selected.push(chosen);
  }
  for (let i=selected.length-1;i>0;i--) {
    const j=Math.floor(random()*(i+1));
    [selected[i],selected[j]]=[selected[j],selected[i]];
  }
  return selected;
}

// Weight the leftmost position, then sample the remaining order uniformly.
// Exclude the preceding case's exact permutation, without reducing its first model's weight.
export function sampleModelOrder(modelIds, leftmostWeights = {}, previous = null, random = Math.random) {
  if (new Set(modelIds).size!==modelIds.length || modelIds.length<2) throw new Error('Distinct model IDs required.');
  const permutations = ids => ids.length ? ids.flatMap((id,i)=>permutations(ids.filter((_,j)=>i!==j)).map(tail=>[id,...tail])) : [[]];
  const same = order => previous && order.every((id,i)=>id===previous[i]);
  const groups=modelIds.map(id=>({id,weight:leftmostWeights[id]??1,orders:permutations(modelIds.filter(other=>other!==id)).map(tail=>[id,...tail]).filter(order=>!same(order))})).filter(group=>group.orders.length);
  if (groups.some(group=>!Number.isFinite(group.weight) || group.weight<=0)) throw new Error('Invalid model placement weight.');
  let ticket=random()*groups.reduce((sum,group)=>sum+group.weight,0),index=0;
  while(index<groups.length-1 && ticket>=groups[index].weight) ticket-=groups[index++].weight;
  return groups[index].orders[Math.floor(random()*groups[index].orders.length)];
}
