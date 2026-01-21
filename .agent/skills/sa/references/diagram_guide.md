# Mermaid Diagram Guide for System Analysis

## 1. Sequence Diagram (循序圖)
用於展示物件之間的交互順序，適合 API 調用流程或訊息傳遞。

```mermaid
sequenceDiagram
    autonumber
    Client->>Server: Request
    Server->>Database: Query
    Database-->>Server: Result
    Server-->>Client: Response
```

## 2. Class Diagram (類別圖)
用於展示資料結構或類別關係。

```mermaid
classDiagram
    class User {
        +String name
        +String email
        +login()
    }
    class Bookmark {
        +String url
        +String title
    }
    User "1" --> "*" Bookmark : owns
```

## 3. State Diagram (狀態圖)
用於展示物件的生命週期狀態變化。

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : fetch()
    Loading --> Success : 200 OK
    Loading --> Error : 500 Fail
    Success --> Idle
    Error --> Idle
```

## 4. Flowchart (流程圖)
用於展示演算法或業務邏輯判斷。

```mermaid
graph TD
    Start --> IsValid{Valid?}
    IsValid -->|Yes| Process[Process Data]
    IsValid -->|No| Log[Log Error]
    Process --> End
    Log --> End
```
