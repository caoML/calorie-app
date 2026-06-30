# NestJS 基础知识讲解（结合热量记录小程序后端实例）

> 本文用一个真实的微信小程序后端项目（热量记录 App）贯穿全部概念，适合有一定 Node.js 基础、想快速理解 NestJS 的人。

---

## 一、NestJS 是什么？一句话说清

**NestJS 是一个帮你把后端代码组织得清晰、规范的 Node.js 框架。**

它的核心思想只有两个：
- **模块化**：按业务拆成独立模块，各管各的。
- **依赖注入（DI）**：需要什么服务，声明一下就行，框架自动给你准备好实例，不用手动 `new`。

不用 NestJS 也能写接口（Express 就行），但项目大了之后代码容易乱成一锅粥。NestJS 相当于给你一套"代码该怎么放"的规矩。

---

## 二、依赖注入与控制反转（理解了这个，NestJS 的"魔法"就不神秘了）

### 先感受问题：没有依赖注入时

```ts
class RecordController {
  private recordService: RecordService;

  constructor() {
    // 你得自己造 Service，还得知道它需要什么
    const dataSource = new DataSource(配置...);     // 先造数据库连接
    const repository = dataSource.getRepository(FoodRecord);  // 再造仓库
    this.recordService = new RecordService(repository);       // 最后造 Service
  }
}
```

痛点：
- Controller 不仅要知道 Service **怎么用**，还得知道它**怎么造**。
- Service 的依赖变了（比如多加一个 RedisService），所有用到它的地方都得跟着改。
- 依赖嵌套时（A 依赖 B，B 依赖 C，C 依赖 D），你要手动按顺序一层层组装。

### 有了依赖注入：你只声明"我要什么"

```ts
@Controller('records')
export class RecordController {
  constructor(private recordService: RecordService) {}
  //          ↑ 只说"我需要 RecordService"，不管它怎么来的
}
```

谁来创建 RecordService？它的 Repository 从哪来？数据库连接谁初始化的？
——**全部由 NestJS 的 IoC 容器自动完成**，你不操心。

### 两个概念的关系

| 概念 | 一句话 |
|------|--------|
| **控制反转（IoC）** | "谁来创建和管理依赖"这件事的**控制权**，从你手里**反转**给了框架 |
| **依赖注入（DI）** | 框架用**构造函数参数**的方式把造好的东西"塞给你"——这是控制反转的**具体实现手段** |

> 控制反转是**思想**（谁来管），依赖注入是**做法**（怎么给）。

### 生活类比

| | 没有控制反转 | 有控制反转 |
|---|---|---|
| 场景 | 你要吃饭，自己买菜、洗菜、炒菜、装盘 | 你去餐厅说"来份番茄炒蛋" |
| 你做的事 | 控制全过程 | 只声明需求 |
| 谁干活 | 你自己 | 餐厅厨房（= IoC 容器） |
| 怎么给你 | 你自己端 | 服务员端给你（= 注入） |

### NestJS 启动时自动做的事（你看不到，但要知道）

```
1. 扫描所有 @Module 里注册的 providers
2. 发现 RecordService 需要 Repository<FoodRecord>
3. 发现 Repository 需要数据库连接
4. 数据库连接在 TypeOrmModule.forRoot() 里已配好
5. 于是框架：创建连接 → 创建 Repository → 创建 Service → 注入到 Controller
```

整棵依赖树从底往上自动构建，你只写声明。

### 为什么值得这样做

| 好处 | 解释 |
|------|------|
| **解耦** | Controller 不知道 Service 怎么造的；换实现时 Controller 不用改 |
| **易测试** | 测试时可以注入假的 Mock Service，不用真连数据库 |
| **不用管顺序** | 谁先创建、谁依赖谁，框架自动排序 |
| **改动影响小** | Service 多加一个依赖，只改 Service 自己，调用方完全不动 |

### 关键标记

在 NestJS 里，跟依赖注入相关的只有两个标记需要记：

| 标记 | 含义 |
|------|------|
| `@Injectable()` | 告诉框架"这个类可以被注入到别的地方" |
| `@Module({ providers: [...] })` | 告诉框架"这些类归我管，我负责它们的创建和注入" |

---

## 三、5 个核心角色（记住这 5 个就够日常开发了）

以热量记录项目为例，目录结构长这样：

```
server/src/
├── main.ts                     # 入口
├── app.module.ts               # 根模块
├── common/
│   ├── guards/auth.guard.ts    # 鉴权守卫
│   └── decorators/user.decorator.ts
└── modules/
    ├── auth/       # 认证模块
    ├── record/     # 饮食记录模块
    ├── food/       # 食物库模块
    └── ...
```

### 1. Module（模块）—— 组织单元

> 类比：一个文件夹的"清单"，声明这个业务包含什么。

```ts
// record.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([FoodRecord])],  // 用到什么数据库表
  controllers: [RecordController],                     // 有哪些接口
  providers: [RecordService],                          // 有哪些服务
})
export class RecordModule {}
```

**规则**：所有模块最终要在根模块 `app.module.ts` 里注册，否则不生效。

---

### 2. Controller（控制器）—— 定义路由，收发请求

> 类比：餐厅的服务员——接收点单（请求），传给厨房（Service），再把菜（响应）端给客人。

```ts
@Controller('records')            // 路由前缀：/api/records
@UseGuards(AuthGuard)             // 整个模块需要登录才能访问
export class RecordController {

  constructor(private recordService: RecordService) {}  // 依赖注入

  @Post()                         // POST /api/records
  create(@CurrentUser('id') userId: number, @Body() dto: CreateRecordDto) {
    return this.recordService.createRecord(userId, dto);
  }

  @Get()                          // GET /api/records?date=2026-06-29
  findByDate(@CurrentUser('id') userId: number, @Query('date') date: string) {
    return this.recordService.getRecordsByDate(userId, date);
  }

  @Delete(':id')                  // DELETE /api/records/123
  remove(@Param('id') id: number) {
    return this.recordService.deleteRecord(id);
  }
}
```

**常用装饰器速查：**

| 装饰器 | 作用 |
|--------|------|
| `@Controller('xxx')` | 路由前缀 |
| `@Get()` `@Post()` `@Put()` `@Delete()` | HTTP 方法 |
| `@Body()` | 取请求体 |
| `@Query('key')` | 取 URL 查询参数 `?key=value` |
| `@Param('id')` | 取路径参数 `/records/:id` |
| `@UseGuards()` | 加鉴权守卫 |

**原则：Controller 只负责"收发"，不写业务逻辑。**

---

### 3. Service（服务）—— 业务逻辑 + 数据库操作

> 类比：厨房——真正干活的地方。

```ts
@Injectable()                      // 标记：我可以被注入到别的地方
export class RecordService {

  constructor(
    @InjectRepository(FoodRecord)
    private recordRepo: Repository<FoodRecord>,   // 注入数据库仓库
  ) {}

  async createRecord(userId: number, dto: CreateRecordDto) {
    const record = this.recordRepo.create({ userId, ...dto });
    return this.recordRepo.save(record);          // 写入数据库
  }

  async getRecordsByDate(userId: number, date: string) {
    return this.recordRepo.find({ where: { userId, date } });  // 查询
  }
}
```

**原则：业务逻辑全部放 Service，Controller 调用 Service 的方法即可。**

---

### 4. Entity（实体）—— 描述数据库表结构

> 类比：表格的表头定义。

```ts
@Entity('food_records')              // 数据库表名
export class FoodRecord {
  @PrimaryGeneratedColumn()
  id: number;                        // 主键，自增

  @Column()
  userId: number;

  @Column()
  date: string;                      // 日期 YYYY-MM-DD

  @Column()
  meal: string;                      // breakfast/lunch/dinner/snack

  @Column()
  foodName: string;

  @Column({ type: 'real' })
  kcal: number;                      // 本次记录热量

  @CreateDateColumn()
  createdAt: Date;                   // 自动填充创建时间
}
```

你定义好 Entity，TypeORM 自动帮你建表（`synchronize: true` 时）。改了字段，表结构自动跟着变。

---

### 5. Guard（守卫）—— 鉴权拦截

> 类比：门卫——没有合法身份证（token）就不让进。

```ts
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // 没带 token → 拒绝
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录');
    }

    // 验证 token
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      request.user = { id: decoded.userId, openid: decoded.openid };
      return true;      // 放行
    } catch (e) {
      throw new UnauthorizedException('登录已过期');
    }
  }
}
```

用法：在 Controller 上加 `@UseGuards(AuthGuard)` 即可。

---

## 四、请求的完整生命周期

```
客户端发请求
    ↓
Global Prefix（/api）—— 所有路由统一加前缀
    ↓
Guard（鉴权）—— 没登录直接 401 打回去
    ↓
Pipe（参数验证）—— 请求体不合规直接 400 打回去
    ↓
Controller（路由分发）—— 找到对应的处理方法
    ↓
Service（业务处理）—— 操作数据库、调用外部接口等
    ↓
返回响应给客户端
```

---

## 五、JWT 鉴权流程详解

本项目用的是标准 JWT 无状态认证，整个流程只有两个阶段：

### 阶段一：登录 → 签发 token（只发生一次）

```
小程序 wx.login() 获取 code
        ↓
POST /api/auth/login { code }
        ↓
服务端拿 code 去微信换 openid
        ↓
查数据库：有这个用户？没有就创建
        ↓
jwt.sign({ userId, openid }, 密钥, { expiresIn: '30d' })
        ↓
返回 { token: "eyJhbG..." } 给小程序
        ↓
小程序把 token 存到 Storage
```

### 阶段二：后续请求 → 验证 token（每次都走）

```
小程序请求头带上 Authorization: Bearer eyJhbG...
        ↓
AuthGuard 拦截：取出 token → jwt.verify(token, 密钥)
        ↓
验证通过 → 解出 userId → 挂到 request.user → 放行
验证失败 → 返回 401
        ↓
Controller 里用 @CurrentUser('id') 直接获取当前用户 ID
```

**为什么小程序适合用 JWT：**
- 小程序没有浏览器 Cookie 机制，不适合 Session 方案
- JWT 是无状态的，服务器不需要存"谁在线"，只验签就行
- 天然适合"客户端自己保管 token、每次请求带上"的模式

---

## 六、TypeORM 是什么？

**一句话：让你用 TypeScript 操作数据库，不用写 SQL。**

对比：

```ts
// 没有 TypeORM（手写 SQL）
db.run('INSERT INTO food_records (userId, kcal) VALUES (?, ?)', [1, 232]);
const rows = db.all('SELECT * FROM food_records WHERE userId = ?', [1]);

// 有了 TypeORM（用对象和方法）
const record = this.recordRepo.create({ userId: 1, kcal: 232 });
await this.recordRepo.save(record);
const records = await this.recordRepo.find({ where: { userId: 1 } });
```

好处：
1. 有类型检查和自动补全，写错字段名直接报红
2. 不用记 SQL 语法
3. 换数据库（SQLite → MySQL）只改配置，业务代码不动

---

## 七、模块之间怎么协作

当 A 模块想用 B 模块的 Service 时：

```ts
// B 模块要"导出"自己的 Service
@Module({
  providers: [UserFoodService],
  exports: [UserFoodService],       // ← 关键：导出
})
export class UserFoodModule {}

// A 模块要"导入" B 模块
@Module({
  imports: [UserFoodModule],         // ← 导入 B 模块
  providers: [FoodService],
})
export class FoodModule {}

// 然后 FoodService 里就能注入 UserFoodService 了
@Injectable()
export class FoodService {
  constructor(private userFoodService: UserFoodService) {}  // 直接用
}
```

**规则**：不 `exports` 的东西是模块私有的，别的模块注入不了。

---

## 八、常用模式速查

| 我想做什么 | 怎么做 |
|-----------|--------|
| 新增一个业务功能 | 建一个 Module（含 Controller + Service + Entity） |
| 定义接口路由 | Controller 里用装饰器 `@Get/@Post/@Put/@Delete` |
| 写业务逻辑 | Service 里用 `@InjectRepository` 操作数据库 |
| 定义数据库表 | Entity 文件用 `@Entity` + `@Column` |
| 接口要登录才能用 | Controller 上加 `@UseGuards(AuthGuard)` |
| 校验请求参数 | 用 DTO 类 + `class-validator` 装饰器（全局 ValidationPipe 自动生效） |
| 获取当前登录用户 | `@CurrentUser('id')` 参数装饰器 |
| 一个模块用另一个模块的服务 | 被用方 `exports`，使用方 `imports` |
| 应用启动时执行初始化逻辑 | Service 里实现 `onModuleInit()` 生命周期钩子 |

---

## 九、项目技术栈总结

| 层 | 技术 |
|----|------|
| 框架 | NestJS（TypeScript） |
| 数据库 | SQLite（better-sqlite3） |
| ORM | TypeORM |
| 认证 | JWT + 微信小程序 jscode2session |
| AI 能力 | 智谱 GLM-4-Plus（OpenAI 兼容接口） |
| 部署 | PM2 / Docker（可选） |

---

## 十、容易踩坑的几个点（必须知道）

### 1. 路由顺序：静态路由要放在动态路由前面

你的 `record.controller.ts` 里有这样的路由：

```ts
@Delete('clear')     // DELETE /api/records/clear
@Delete(':id')       // DELETE /api/records/123
```

**`clear` 必须写在 `:id` 前面**。否则 NestJS 会把 `clear` 当成一个 id 去匹配 `:id` 路由，永远走不到你想要的那个方法。

同理 `@Get('recent-foods')` 要放在 `@Get(':id')` 前面（如果有的话）。

**规则：具体的写前面，模糊的写后面。**

---

### 2. 异步/同步：Controller 方法记得加 async + await

```ts
// ✅ 正确
@Post()
async create(@Body() body: any) {
  const data = await this.recordService.create(userId, body);
  return { code: 0, data };
}

// ❌ 忘了 await——返回的是 Promise 对象，前端拿到的数据是空的或乱的
@Post()
create(@Body() body: any) {
  const data = this.recordService.create(userId, body);  // 没 await！
  return { code: 0, data };  // data 是个 Promise，不是结果
}
```

只要 Service 里有数据库操作（都是异步的），Controller 调用时就必须 `await`。

---

### 3. 响应状态码：NestJS 的默认行为

| HTTP 方法 | NestJS 默认状态码 |
|-----------|-----------------|
| GET | 200 |
| POST | **201**（不是 200！） |
| PUT / PATCH / DELETE | 200 |

你前端 `request.js` 里已经处理了这点（`statusCode >= 200 && < 300` 都算成功）。但如果哪天你用别的客户端测试，看到 POST 返回 201 不是 bug，是 NestJS 的默认行为。

如果想统一返回 200，可以在方法上加 `@HttpCode(200)`：

```ts
@Post()
@HttpCode(200)   // 强制返回 200 而不是默认的 201
async create() { ... }
```

---

### 4. DTO 验证：为什么 @Body() 后面应该跟 DTO 类而不是 any

你现在 Controller 里写的是 `@Body() body: any`，意味着前端传什么都接受、不做校验。

NestJS 提供了优雅的参数验证方式——用 DTO（Data Transfer Object）类：

```ts
// create-record.dto.ts
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateRecordDto {
  @IsString()
  date: string;          // 必传，且必须是字符串

  @IsString()
  meal: string;          // 必传

  @IsString()
  foodName: string;      // 必传

  @IsNumber()
  kcal: number;          // 必传，且必须是数字

  @IsOptional()
  @IsNumber()
  amount?: number;       // 可选
}

// Controller 里把 any 换成 DTO
@Post()
async create(@Body() dto: CreateRecordDto) { ... }
```

因为你 `main.ts` 里全局开启了 `ValidationPipe`，所以前端传的参数只要不符合 DTO 定义，NestJS **自动返回 400 错误并告诉前端哪个字段有问题**，不用你手写 if-else 校验。

**好处**：防止前端传错参数、防止恶意请求、代码更健壮。
**建议**：当你项目稳定后，把 `body: any` 逐步换成 DTO。

---

### 5. 错误处理：NestJS 内置的异常类

NestJS 自带一套标准异常，抛出来框架会自动处理成对应的 HTTP 状态码：

```ts
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

// 找不到资源 → 自动返回 404
throw new NotFoundException('记录不存在');

// 参数错误 → 自动返回 400
throw new BadRequestException('日期格式不正确');

// 没有权限 → 自动返回 403
throw new ForbiddenException('无权操作');

// 未登录 → 自动返回 401（你的 AuthGuard 里用的就是这个）
throw new UnauthorizedException('登录已过期');
```

你不用手动设置状态码，抛异常就行，NestJS 自动把异常转成标准的 HTTP 错误响应。

---

### 6. 环境变量：`process.env` 的生效时机

你的代码里有这样的写法：

```ts
// auth.guard.ts 顶部
const JWT_SECRET = process.env.JWT_SECRET || 'calorie-app-secret-key-2024';
```

这行在**模块加载时**就执行了（只执行一次）。因为你在 `main.ts` 第一行 `import 'dotenv/config'` 确保了 `.env` 在所有代码之前就加载好，所以没问题。

但要注意：**如果你把 `dotenv/config` 的导入位置改了或删了，所有 `process.env.xxx` 都会读到 `undefined`，只走默认值。** 这是个常见坑。

---

### 7. 前后端对接约定（你项目里的实际约定）

看你的 Controller 和 `request.js`，你们的约定是：

```ts
// 后端统一返回格式
{ code: 0, data: ... }         // 成功
{ code: 0, message: '...' }    // 成功（无数据，只返消息）
// 失败靠 HTTP 状态码（401/400/404）+ NestJS 默认的 error body
```

前端判断：
```js
statusCode >= 200 && < 300  →  成功，取 res.data
statusCode === 401          →  token 失效，自动重新登录重试
其他                        →  reject
```

这个约定简洁有效，但**建议记在文档里**，免得以后新加接口时忘了统一格式。

---

## 十一、总结：NestJS 的本质

NestJS 不做什么"魔法"，它做的就是：

1. **规定代码怎么放**（Module / Controller / Service / Entity 各司其职）
2. **自动帮你组装**（依赖注入，你声明需要什么，框架帮你创建并传入）
3. **提供一套标准流水线**（Guard → Pipe → Controller → Service → 响应）

掌握了上面的 5 个角色 + 请求流程 + JWT 鉴权，日常增删改查就覆盖了 90% 的场景。Interceptor、Filter、Middleware 等进阶概念，等遇到具体需求时再学即可。
