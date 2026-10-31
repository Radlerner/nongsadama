import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    // 쓰기는 오프라인이어도 멈추지 않고 바로 실패시킨다('online'이면 isPending이 영원히 남아
    // 동의·삭제 시트가 닫히지 않고, 다시 연결되면 사용자가 포기한 요청이 저절로 나간다).
    // 읽기는 기본값('online')대로 멈춰서(fetchStatus 'paused') 화면이 '인터넷이 연결되면 불러와요' 상태를 보여 준다.
    mutations: {
      networkMode: 'always',
    },
  },
})
