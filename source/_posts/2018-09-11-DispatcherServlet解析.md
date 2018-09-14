---
title: DispatcherServlet解析
comments: true
date: 2018-09-13 21:55:53
tags: Servlet
categories: spring
---
&emsp;&emsp;有朋友说，你搞了这么久Java，怎么天天写的都是Java基础，现在流行微服务啊～分布式啊～恩。。。主要还是要学习的内容太多了，感觉写个一年半载也写不完，不过为了与时俱进，后面也会偶尔写点这方面的内容，就以SpringCloud全家桶作为主要介绍对象，感兴趣的朋友们快快提前关注啊～～～好了，下面进入正题～
&emsp;&emsp;在《Tomcat服务器结构浅析（一）》中我们介绍到Web请求在到达Tomcat服务器后，经过一层层容器地查找以及地址的匹配，最后请求被交由Servlet进行处理：
![Tomcat请求处理](./Tomcat请求处理.PNG)
&emsp;&emsp;在SpringMVC框架中，占据核心位置的便是DispatcherServlet。在下面的内容中，让我们来看一下，SpringMVC是如何通过DispatcherServlet来处理请求的。

# Servlet
&emsp;&emsp;Servlet（Server Applet），全称Java Servlet。是用Java编写的服务器端程序。其主要功能在于交互式地浏览和修改数据，生成动态Web内容。狭义的Servlet是指Java语言实现的一个接口，广义的Servlet是指任何实现了这个Servlet接口的类，一般情况下，人们将Servlet理解为后者。
&emsp;&emsp;Servlet运行于支持Java的应用服务器中。从实现上讲，Servlet可以响应任何类型的请求，但绝大多数情况下Servlet只用来扩展基于HTTP协议的Web服务器。
&emsp;&emsp;最早支持Servlet标准的是JavaSoft的Java Web Server。此后，一些其它的基于Java的Web服务器开始支持标准的Servlet。
&emsp;&emsp;一个Web请求的过程如下：
1. WEB服务器接收一个用户请求；
2. WEB服务器将请求转交给WEB服务器关联的Servlet容器；
3. Servlet容器找到对应的Servlet并执行这个Servlet；
4. Servlet容器将处理结果返回给WEB服务器；
5. WEB服务器把结果送回用户；
&emsp;&emsp;而在Servlet处理请求的过程当中，又是怎样的一个流程呢？

## Servlet生命周期
&emsp;&emsp;Servlet的生命（周期）是由容器管理的，换句话说，Servlet程序员不能用代码控制其生命。
```
public interface Servlet {
    public void init(ServletConfig config) throws ServletException;
    
    public ServletConfig getServletConfig();

    public void service(ServletRequest req, ServletResponse res)
            throws ServletException, IOException;

    public String getServletInfo();

    public void destroy();
}
```
1. 加载和实例化： 
&emsp;&emsp;时机取决于web.xml的定义，如果是比较原始的开发方式（通过配置文件定义Servlet），如果有<load-on-startup>x</load-on-startup>则在容器启动时，反之则在第一次针对这个Servlet的请求发生时。

2. 初始化： 
实例化后会立马进行初始化。也就是执行init方法。

3. 请求处理： 
&emsp;&emsp;初始化后，Servlet就可以接受请求了。基本方式是执行Servlet接口中的service方法。

4. 终止服务：
&emsp;&emsp;容器会在合适的时候销毁某个Servlet对象，这个策略取决于容器的开发者/商。在容器关闭的时候Servlet对象一定会被销毁。
Servlet对象被销毁时，destroy方法会被调用。

&emsp;&emsp;当一个请求到达Servlet后，该Servlet的service方法将会得到调用，而具体的业务逻辑，就可以通过该方法来实现了。

# DispatcherServlet
&emsp;&emsp;接下来，开始讲解今天的主角——``DispatcherServlet``。首先，还是让我们来看一看，DispatcherServlet的类继承图：
![DispatcherServlet继承图](./DispatcherServlet继承图.PNG)

## DispatcherServlet调用链
&emsp;&emsp;Aware类主要是提供了一个能够响应容器各阶段变化的机制，在这里不是我们关注的重点，因此，我们主要来看Servlet部分的继承树。从图中我们可以看到，DispatcherServlet的祖先之一便是Servlet接口。在Servlet生命周期部分，我们提到，请求是通过Servlet的service来进行处理的，可是在DispatcherServlet中，我们并不能找到该函数的定义。其实，service方法是被定义在其父类FrameworkServlet中的，而FrameworkServlet重写了父类HttpServlet的service方法。HttpServlet的service方法定义如下：
```
protected void service(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException {

        String method = req.getMethod();

        if (method.equals(METHOD_GET)) {
            long lastModified = getLastModified(req);
            if (lastModified == -1) {
                // servlet doesn't support if-modified-since, no reason
                // to go through further expensive logic
                doGet(req, resp);
            } else {
                long ifModifiedSince;
                try {
                    ifModifiedSince = req.getDateHeader(HEADER_IFMODSINCE);
                } catch (IllegalArgumentException iae) {
                    // Invalid date header - proceed as if none was set
                    ifModifiedSince = -1;
                }
                if (ifModifiedSince < (lastModified / 1000 * 1000)) {
                    // If the servlet mod time is later, call doGet()
                    // Round down to the nearest second for a proper compare
                    // A ifModifiedSince of -1 will always be less
                    maybeSetLastModified(resp, lastModified);
                    doGet(req, resp);
                } else {
                    resp.setStatus(HttpServletResponse.SC_NOT_MODIFIED);
                }
            }

        } else if (method.equals(METHOD_HEAD)) {
            long lastModified = getLastModified(req);
            maybeSetLastModified(resp, lastModified);
            doHead(req, resp);

        } else if (method.equals(METHOD_POST)) {
            doPost(req, resp);

        } else if (method.equals(METHOD_PUT)) {
            doPut(req, resp);

        } else if (method.equals(METHOD_DELETE)) {
            doDelete(req, resp);

        } else if (method.equals(METHOD_OPTIONS)) {
            doOptions(req,resp);

        } else if (method.equals(METHOD_TRACE)) {
            doTrace(req,resp);

        } else {
            //
            // Note that this means NO servlet supports whatever
            // method was requested, anywhere on this server.
            //

            String errMsg = lStrings.getString("http.method_not_implemented");
            Object[] errArgs = new Object[1];
            errArgs[0] = method;
            errMsg = MessageFormat.format(errMsg, errArgs);

            resp.sendError(HttpServletResponse.SC_NOT_IMPLEMENTED, errMsg);
        }
    }
```
&emsp;&emsp;其主要是根据请求的不同，将请求交由不同的处理函数来处理。而FrameworkServlet重写的service方法则很简单：
```
protected void service(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		HttpMethod httpMethod = HttpMethod.resolve(request.getMethod());
		if (HttpMethod.PATCH == httpMethod || httpMethod == null) {
			processRequest(request, response);
		}
		else {
			super.service(request, response);
		}
	}
```
&emsp;&emsp;当请求是PATCH请求或者无法获取到请求方法类型时，则直接调用processRequest处理请求，否则，有父类HttpServlet的service来处理，而通过上面我们知道HttpServlet的service主要是根据方法类型，调用了不同的请求处理方法。比如，如果是一个Get请求，则调用的doGet方法，如果是Post请求，则调用的是doPost方法。而这几个方法在FrameworkServlet中被重载，以doGet为例：
```
protected final void doGet(HttpServletRequest request, HttpServletResponse response)
			throws ServletException, IOException {

		processRequest(request, response);
	}
```
&emsp;&emsp;可以看到，请求最终还是交由processRequest函数处理。processRequest是一个final方法，不能被子类重载，在该方法中，调用了doService方法，而DispatcherServlet实现了doService方法，到此，请求最终进入到DispatcherServlet中被消费。在doService中，除了设置请求的属性及一些简单的操作外，主要是调用了doDispatch方法来处理请求的。

## DispatcherServlet几个重要成员
&emsp;&emsp;在介绍DispatcherServlet处理请求的流程前，让我们先来认识几个DispatcherServlet类重要的几大组件：
```
    // 文件上传组件
    /** MultipartResolver used by this servlet */
	private MultipartResolver multipartResolver;

    // 资源定位组件
	/** LocaleResolver used by this servlet */
	private LocaleResolver localeResolver;

    // 主题解析组件
	/** ThemeResolver used by this servlet */
	private ThemeResolver themeResolver;

    // 处理器映射器组件集合
	/** List of HandlerMappings used by this servlet */
	private List<HandlerMapping> handlerMappings;

    // 处理器适配器组件集合
	/** List of HandlerAdapters used by this servlet */
	private List<HandlerAdapter> handlerAdapters;

    // 异常处理解析器集合
	/** List of HandlerExceptionResolvers used by this servlet */
	private List<HandlerExceptionResolver> handlerExceptionResolvers;

    // 视图名解析器
	/** RequestToViewNameTranslator used by this servlet */
	private RequestToViewNameTranslator viewNameTranslator;

    // 重定向及FlashMap存储组件
	/** FlashMapManager used by this servlet */
	private FlashMapManager flashMapManager;

    // 视图解析组件集合
	/** List of ViewResolvers used by this servlet */
	private List<ViewResolver> viewResolvers;
```

&emsp;&emsp;SpringMVC定义了一套默认的组件实现类，也就是说，即使在Spring容器中没有显示定义组件，DisoatcherServlet也会装配好一套可用的默认组件，在org/springframework/web/servlet类路径下有一个DispatcherServlet.properties配置文件，内容如下：
```
# Default implementation classes for DispatcherServlet's strategy interfaces.
# Used as fallback when no matching beans are found in the DispatcherServlet context.
# Not meant to be customized by application developers.

org.springframework.web.servlet.LocaleResolver=org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver

org.springframework.web.servlet.ThemeResolver=org.springframework.web.servlet.theme.FixedThemeResolver

org.springframework.web.servlet.HandlerMapping=org.springframework.web.servlet.handler.BeanNameUrlHandlerMapping,\
	org.springframework.web.servlet.mvc.annotation.DefaultAnnotationHandlerMapping

org.springframework.web.servlet.HandlerAdapter=org.springframework.web.servlet.mvc.HttpRequestHandlerAdapter,\
	org.springframework.web.servlet.mvc.SimpleControllerHandlerAdapter,\
	org.springframework.web.servlet.mvc.annotation.AnnotationMethodHandlerAdapter

org.springframework.web.servlet.HandlerExceptionResolver=org.springframework.web.servlet.mvc.annotation.AnnotationMethodHandlerExceptionResolver,\
	org.springframework.web.servlet.mvc.annotation.ResponseStatusExceptionResolver,\
	org.springframework.web.servlet.mvc.support.DefaultHandlerExceptionResolver

org.springframework.web.servlet.RequestToViewNameTranslator=org.springframework.web.servlet.view.DefaultRequestToViewNameTranslator

org.springframework.web.servlet.ViewResolver=org.springframework.web.servlet.view.InternalResourceViewResolver

org.springframework.web.servlet.FlashMapManager=org.springframework.web.servlet.support.SessionFlashMapManager
```
&emsp;&emsp;如果我们希望采用非默认类型的组件，则只需要在Spring配置文件中配置自定义的组件Bean即可。SpringMVC一旦发现上下文中有用户自定义的组件，就不会使用默认的组件了。

## doDispatch方法
&emsp;&emsp;接下来，我们来看下doDispatch方法是如何处理一个Web请求的。首先是一个处理路径图：
![DispatcherServlet请求处理流程](./DispatcherServlet请求处理流程.jpg)
&emsp;&emsp;下面，让我们以上面的图为参照，来解析一下doDispatch函数的处理逻辑

```
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) throws Exception {
		HttpServletRequest processedRequest = request;
		HandlerExecutionChain mappedHandler = null;
		boolean multipartRequestParsed = false;

        // 获取异步请求处理管理器，当业务逻辑复杂（或者其他原因），为了避免请求线程阻塞，需要委托给另一个线程的时候会使用该处理器来处理请求
		WebAsyncManager asyncManager = WebAsyncUtils.getAsyncManager(request);

		try {
			ModelAndView mv = null;
			Exception dispatchException = null;

			try {
                // 检查是否为文件上传请求，如果是的话则将request包装为一个MultipartHttpServletRequest（继承自HttpServletRequest）请求
				processedRequest = checkMultipart(request);

                //若与原始请求不同，说明是一个文件上传请求，否则为一个普通的请求
				multipartRequestParsed = (processedRequest != request);

                // 根据请求，获取处理器请求执行链，否则该请求不能被应用处理
				// Determine handler for the current request.
				mappedHandler = getHandler(processedRequest);
				if (mappedHandler == null || mappedHandler.getHandler() == null) {
					noHandlerFound(processedRequest, response);
					return;
				}

                // 获取处理器适配器
				// Determine handler adapter for the current request.
				HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());

                // 如果是GET或者HEAD请求，调用HandlerAdapter.getLastModified方法看看目标Controller方法在对于该请求有没有可用的lastModified逻辑，如果有的话就使用ServletWebRequest.checkNotModified逻辑判断当前lastModfied值和http header的上次缓存值，如果还没有过期就设置304头并且返回并结束整个请求流程。否则继续。
				// Process last-modified header, if supported by the handler.
				String method = request.getMethod();
				boolean isGet = "GET".equals(method);
				if (isGet || "HEAD".equals(method)) {
					long lastModified = ha.getLastModified(request, mappedHandler.getHandler());
					if (logger.isDebugEnabled()) {
						logger.debug("Last-Modified value for [" + getRequestUri(request) + "] is: " + lastModified);
					}
					if (new ServletWebRequest(request, response).checkNotModified(lastModified) && isGet) {
						return;
					}
				}

                // 处理请求前，先调用处理器执行链前置方法，内部主要是调用了拦截器的前置方法
				if (!mappedHandler.applyPreHandle(processedRequest, response)) {
					return;
				}

                // 使用处理器适配器来处理请求并返回模型视图对象
				// Actually invoke the handler.
				mv = ha.handle(processedRequest, response, mappedHandler.getHandler());

                // 检查异步处理是否已经开始了，如果开始了则目前的线程不再继续处理该请求，直接返回
				if (asyncManager.isConcurrentHandlingStarted()) {
					return;
				}

                // 如果模型视图对象不为null且存在视图，则设置该视图的名字
				applyDefaultViewName(processedRequest, mv);

                // 处理请求后，调用处理器执行链后置方法，内部主要是调用了拦截器的后置方法
				mappedHandler.applyPostHandle(processedRequest, response, mv);
			}
			catch (Exception ex) {
				dispatchException = ex;
			}
			catch (Throwable err) {
				// As of 4.3, we're processing Errors thrown from handler methods as well,
				// making them available for @ExceptionHandler methods and other scenarios.
				dispatchException = new NestedServletException("Handler dispatch failed", err);
			}

            // 处理请求分发处理结果，如处理异常，解析视图内容等
			processDispatchResult(processedRequest, response, mappedHandler, mv, dispatchException);
		}
		catch (Exception ex) {
			triggerAfterCompletion(processedRequest, response, mappedHandler, ex);
		}
		catch (Throwable err) {
			triggerAfterCompletion(processedRequest, response, mappedHandler,
					new NestedServletException("Handler processing failed", err));
		}
		finally {
            // 如果异步请求处理管理器已开始处理该请求，则调用处理器执行链的回调函数，其内部主要是调用了AsyncHandlerInterceptor类型的拦截器
			if (asyncManager.isConcurrentHandlingStarted()) {
				// Instead of postHandle and afterCompletion
				if (mappedHandler != null) {
					mappedHandler.applyAfterConcurrentHandlingStarted(processedRequest, response);
				}
			}
			else {
                //关闭由于文件上传请求导致的打开的资源
				// Clean up any resources used by a multipart request.
				if (multipartRequestParsed) {
					cleanupMultipart(processedRequest);
				}
			}
		}
	}
```
&emsp;&emsp;在多数的场景到中，我们编写控制器，使用@RestController注解对控制器进行注解，使用@GetMapping注解标注函数，dispatcherServlet的重点，就在如何将请求分发到具体的Controller中的方法中。
通过上面源码的讲解可以看出，其重点就在于通过请求获取处理器执行链HandlerExecutionChain（其内部主要是对处理该请求的对象方法的封装及处理器拦截器的包装）及处理器适配器HandlerAdapter。接下来我们看下获取处理器执行链HandlerExecutionChain的getHandler方法：
```
protected HandlerExecutionChain getHandler(HttpServletRequest request) throws Exception {
		for (HandlerMapping hm : this.handlerMappings) {
			if (logger.isTraceEnabled()) {
				logger.trace(
						"Testing handler map [" + hm + "] in DispatcherServlet with name '" + getServletName() + "'");
			}
			HandlerExecutionChain handler = hm.getHandler(request);
			if (handler != null) {
				return handler;
			}
		}
		return null;
	}
```
&emsp;&emsp;其主要的逻辑是通过处理器映射器来解析请求，并返回正确的HandlerExecutionChain,HandlerMapping接口如下：
![HandlerMapping继承图](./HandlerMapping继承图.PNG)
&emsp;&emsp;上述的几个实现类通过不同的策略，将请求的路径映射到对应的处理器上。当我们访问由@RestController标注的类下的接口时（此处以ConfigController下的list接口为例），其最终便是由RequestMappingHandlerMapping解析的出了HandlerExecutionChain，通过断点可以看到：
![HandlerExecutionChain结构](./HandlerExecutionChain结构.png)
&emsp;&emsp;该处理器执行链中已经包含了处理该请求的接口的一些信息，后续的工作便是使用该接口处理请求。而这些工作都是通过处理器适配器HandlerAdapter来完成。接下来看一下HandlerAdapter的继承图：
![DispatcherServlet请求处理流程](./HandlerAdapter继承图.PNG)
&emsp;&emsp;上述请求获取到的处理器对应的适配器便是RequestMappingHandlerAdapter
![获取HandlerAdapter](./获取HandlerAdapter.PNG)
&emsp;&emsp;之后，便是执行HandlerExecutionChain中拦截器的前置方法，通过适配器执行处理器对请求的处理过程并返回模型视图对象，再执行HandlerExecutionChain中拦截器的后置方法。最后，便是根据处理器对请求的处理情况，对结果进行最终的解析，方法processDispatchResult：
```
/**
	 * Handle the result of handler selection and handler invocation, which is
	 * either a ModelAndView or an Exception to be resolved to a ModelAndView.
	 */
	private void processDispatchResult(HttpServletRequest request, HttpServletResponse response,
			HandlerExecutionChain mappedHandler, ModelAndView mv, Exception exception) throws Exception {

		boolean errorView = false;

		if (exception != null) {
			if (exception instanceof ModelAndViewDefiningException) {
				logger.debug("ModelAndViewDefiningException encountered", exception);
				mv = ((ModelAndViewDefiningException) exception).getModelAndView();
			}
			else {
				Object handler = (mappedHandler != null ? mappedHandler.getHandler() : null);
				mv = processHandlerException(request, response, handler, exception);
				errorView = (mv != null);
			}
		}

		// Did the handler return a view to render?
		if (mv != null && !mv.wasCleared()) {
			render(mv, request, response);
			if (errorView) {
				WebUtils.clearErrorRequestAttributes(request);
			}
		}
		else {
			if (logger.isDebugEnabled()) {
				logger.debug("Null ModelAndView returned to DispatcherServlet with name '" + getServletName() +
						"': assuming HandlerAdapter completed request handling");
			}
		}

		if (WebAsyncUtils.getAsyncManager(request).isConcurrentHandlingStarted()) {
			// Concurrent handling started during a forward
			return;
		}

		if (mappedHandler != null) {
			mappedHandler.triggerAfterCompletion(request, response, null);
		}
	}
```
&emsp;&emsp;从注释中可以看出，该方法便是根据处理器处理结果是抛出异常还是返回模型视图对象，对结果进一步做了处理。若处理器返回了模型视图对象，对视图的渲染，便是在该函数中通过调用render函数来完成的。由于对标注了@RestController的控制器，其返回的模型视图对象是null，故不会进行渲染，在这里也就不再将视图渲染的内容展开来讲了。

&emsp;&emsp;至此，DispatcherServlet主要的工作大致就分析完了。想要自己一探究竟的朋友，可以自己写一个小接口，通过断点走一边流程，相信会对DispatcherServlet有更深入的理解～～