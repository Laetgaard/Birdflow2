export async function getTotalCreators(): Promise<number> {
  try {
    const response = await fetch("/api/public/stats");
    
    if (!response.ok) {
      console.error("Error fetching stats: HTTP", response.status);
      return 1247;
    }
    
    const data = await response.json();
    return data.totalCreators || 1247;
  } catch (err) {
    console.error("Error fetching stats:", err);
    return 1247;
  }
}
