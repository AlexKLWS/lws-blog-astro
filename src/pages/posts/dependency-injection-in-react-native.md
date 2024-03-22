The patterns and approaches discussed in this post could be considered rather advanced, so I tried my best to be as elaborate and clear as possible. Please let me know if you have any thoughts on how to improve this post!

### Motivation

It is of the utmost importance that we plan out our app system architecture as early as possible, preferably, from the very beginning. However, being able to start a project from the blank slate is a rare "luxury". More often we end up working on a project that had already spent some time in development. Also very often, the project we end up working on is a mess. No tests, no coherent organization, everything is very tightly coupled together – does this sound familiar? But even when we do get a chance to build the project from the ground up, it doesn't mean it'll always turn out the way we want it to. Many times we rush to deliver at least _something_, make an MVP or POC and then build on that. During this initial rushed stage, we don't have time to consider anything other than just "making it work". What our architecture is going to be like? Well, basically, we just make it up as we go. After a while, we can no longer allow for a project to simply grow "naturally". We need to ensure that our **codebase is maintainable**, our **test coverage is extensive** and our **architecture enables us to deliver new features and fixes quickly**. The further the development progresses, the more often the question is brought up – "How do we manage all this complexity?" There's no ultimate answer to this question, there's no one-size-fits-all solution. The good news is, there're many excellent tools that could help greatly in solving this issue. Unfortunately, too many developers don't know about them and try to reinvent the wheel. For example, when it comes to React/React-Native apps in particular, I've seen too many times Redux being used as a go-to solution for managing higher-level business logic. (No, this isn't what Redux is for.) Even if you're the smartest person on Earth, using other people's knowledge is always a good idea. Humanity got this far only because we shared information between us and built on top of each other's discoveries and inventions. Reading about a pattern after I've organically arrived at using it on my own without knowing "that this thing I've been doing actually has a name" always feels frustrating to me. Just how much time and effort could've been saved only if I knew about it sooner, and didn't have to invent it on my own? Never step on the same rakes as other people. Learn from other's mistakes and successes. So let's tap into the endless ocean of our collective knowledge and experience. What's in there? Best practices, design patterns, development processes – a whole slew of tools for us to learn and use. For complex systems, I strongly recommend [Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection). Why? Here're some of its benefits:

- It helps managing instantiation and caching
- It significantly simplifies testing. TDD becomes extremely easy.
- It enables a truly modular and decoupled architecture
- It provides an easy way to access singletons or shared instances
- It provides an easy way to override and extend existing configurations

In short, DI is great. [OOP](https://en.wikipedia.org/wiki/Object-oriented_programming) is great. [SOLID](https://en.wikipedia.org/wiki/SOLID) is great. Those are facts, proven by software developed in the past decades. If you are unfamiliar with these terms, it is very important that you make an effort to learn and truly understand them before implementing the pattern described in this post. I recommend [Robert C. Martin's Clean Code](https://www.oreilly.com/library/view/clean-code-a/9780136083238/) as one of the best books on using SOLID in real life. I think [Object-Oriented Thought Process](https://www.oreilly.com/library/view/the-object-oriented-thought/9780135182130/) is a great read as well. This video in my opinion is one of the best tutorials on DI out there, so make sure to check it out.

<iframe width="100%" height="315" src="https://www.youtube-nocookie.com/embed/QtDTfn8YxXg" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

A good understanding of these concepts is very important. So without any further ado, I'll go through one of the most robust, effective and reliable approaches to organizing React Native app architecture. I've been using it in many of my projects and it has been working out **incredibly** well.

### What about the web?

Right off the bat, I'd like to note that in my opinion this pattern shouldn't be used for most web apps. Even though Inversify is a relatively lightweight library – the size is around 4KB – on the web every byte matters. `reflect-metadata` could also bloat the bundle size significantly. I strongly recommend that the use of RxJS is avoided on the web unless your app is as complex as Figma or Clubhouse.io. The library package size is 45.6KB bundled. I'll get in detail on how this approach could be implemented without RxJS in the closing parts of this post. But the size isn't the only concern here. This approach creates an overhead, that should be avoided on web clients at all costs. The ideal state for a web application is a statically served page, so our architecture design should gravitate towards using as little Javascript as possible. After all, [we do have a Javascript problem on the web](https://twitter.com/malchata/status/1396849803900989446?s=20). This is a completely different platform, with completely different requirements, and we should take those into consideration. The less code we write on the front-end, the simpler and "dumber" it is – the better. If you're using something as sophisticated as DI pattern for a simple blog, you're doing something wrong. I've learned this the hard way while creating this website.

### The Basics

Let's begin. What's Inversify? From their [website](https://inversify.io):

> InversifyJs is a powerful and lightweight inversion of control container for JavaScript & Node.js apps powered by TypeScript.

This tool helps writing clean and efficient OO code adhering to all SOLID principles by making it possible to implement a proper Dependency Injection pattern. Here's how it works.

```
import { Container, injectable, inject } from "inversify";

@injectable()
class Katana {
    public hit() {
        return "cut!";
    }
}

@injectable()
class Shuriken {
    public throw() {
        return "hit!";
    }
}

@injectable()
class Ninja implements Warrior {

    private _katana: Katana;
    private _shuriken: Shuriken;

    public constructor(katana: Katana, shuriken: Shuriken) {
        this._katana = katana;
        this._shuriken = shuriken;
    }

    public fight() { return this._katana.hit(); };
    public sneak() { return this._shuriken.throw(); };

}

var container = new Container();
container.bind<Ninja>(Ninja).to(Ninja);
container.bind<Katana>(Katana).to(Katana);
container.bind<Shuriken>(Shuriken).to(Shuriken);
```

Pretty neat, eh? But how do we make it work with React? Usually, a container takes care of creating object instances and provides all of the dependencies via a constructor. This is where things get complicated since in React we don't have easy access to (class-components') constructors. How do we bind our components to a container? There're a couple of tricks we can use. For example, one of the working solutions is to use `@lazyInject` decorators. The idea is that since the object creation has already been taken care of, the dependencies are injected at the moment they're referenced, instead of at object instantiation time. Here's a [great post](https://itnext.io/dependency-injection-in-react-using-inversifyjs-a38ff0c6601) by Tomasz Świstak explaining this and a couple of other approaches. However, you might notice that this post is also a little outdated. Many libraries referenced there haven't been maintained for years and probably no longer work. And with the advent of hooks, you can rarely find class components being used these days. But don't worry, making it work with hooks is just as easy. Here's [another post](https://itnext.io/dependency-injection-in-react-using-inversifyjs-now-with-react-hooks-64f7f077cde6) by Tomasz where he goes over how to inject services into functional components using hooks. Here's the code for the most important part. I've modified it just a tiny little bit to adapt it to my personal use.

```
import React, { useContext } from 'react';
import { Container, interfaces } from 'inversify';

const InversifyContext = React.createContext<{ container: Container | null }>({ container: null });

type Props = {
  container: Container
}

export const ServiceProvider: React.FC<Props> = (props) => {
  return (
    <InversifyContext.Provider value={{ container: props.container }}>
      {props.children}
    </InversifyContext.Provider>
  );
}

export function useInjection<T>(identifier: interfaces.ServiceIdentifier<T>) {
  const { container } = useContext(InversifyContext);
  if (!container) {
    throw new Error('No context container!');
  }
  return container.get<T>(identifier);
}
```

The idea is pretty straightforward – we store our DI container in the React Context and create a convenient hook that first retrieves the container from context, and then retrieves the dependency from the container. Here's what it looks like in action. Let's say we have a service that provides a certain kind of data. In our case, let it be the name of the user. Here it is:

```
interface INameService {
  getName: () => string
}

@injectable()
class NameService implements INameService {

    private _name: string;

    public getName() { return this._name; };
}

const NameServiceId = Symbol('NameService');

```

We bind this service to our container.

```
Container.bind<INameService>(NameServiceId).to(NameService);
```

And then use it in our React components.

```
import React from 'react';
import { useInjection } from './ioc.react';
import { INameService, NameServiceId } from './services';

export const Hello: React.FC = () => {
    const service = useInjection<INameService>(NameServiceId);

    return (
        <h1>Hello {service.getName()}!</h1>
    );
};
```

This looks pretty good already, but we aren't quite there yet.
Let's imagine the `name` value isn't immediately available, and we need to fetch it from some backend API first. This way, our `NameService` could look something like this:

```
@injectable()
class NameService implements INameService {

    private _name: string = '';

    public getName() { return this._name; };

    public fetchName() {
      fetchNameFromAPI().then((name) => {
	      this._name = name;
      });
	  };
}
```

And in our `Hello` component we could be fetching name on the first component mount like this:

```
export const Hello: React.FC = () => {
    const service = useInjection<INameService>(NameServiceId);

		useEffect(() => {
			service.fetchName();
		}, []);

    return (
        <h1>Hello {service.getName()}!</h1>
    );
};
```

You could probably already see the problem. Even if we successfully retrieve the name from the API and store it in the service property, the component won't be re-rendered because neither state nor the props are being updated. The approach we've been using so far is _imperative_. How do we make it _reactive_? My solution is to use [RxJS](https://rxjs.dev). I'll go into the details of this in a bit, but for now, I'd like to elaborate on a few things. You might think "Isn't it a little bit of an overkill?" Well, yeah it is. But you aren't limited to strictly using RxJS only for the functionality described in this post. It's an extremely powerful and useful library that you can utilize to the full extent anywhere throughout your app. If anything, using RxJS with DI will drive you towards using it in other parts of your app which in its turn could also significantly improve your app's maintainability and performance. But then again, it isn't an absolute requirement.

So, how does it work? First, make those class properties on which our UI state depends into `BehaviorSubjects`. Then, instead of simply assigning a new value to a property, we need to call `next()`. Here's what it'll look like

```
@injectable()
class NameService implements INameService {

    private _name: BehaviorSubject<string> = new BehaviorSubject<string>('');

    public getName() { return this._name; };

    public fetchName() {
      fetchNameFromAPI().then((name) => {
	      this._name.next(name);
      });
	  };
}
```

You might notice that `getName` no longer returns a `string` but a `BehaviorSubject<string>` instead. This is fine because we won't be accessing it in our component directly. In fact, we will abstract away all service-related logic into something called a [facade](https://en.wikipedia.org/wiki/Facade_pattern). This idea, and a couple of other RxJS tricks I've picked up in [this post](https://thomasburlesonia.medium.com/https-medium-com-thomasburlesonia-react-hooks-rxjs-facades-4e116330bbe1) by Thomas Burleson. We'll use this little `onEmit` helper method to make our life a bit easier.

```
export function onEmit<T>(source: Observable<T>, nextFn: (value: T) => void): Subscription {
  return source.subscribe({
    next: nextFn,
    error: (err) => console.error(err),
  });
}
```

Then, we'll create a facade, that will only expose the `name` string and `fetchName` function like this.

```
const useNameProvider = () => {
  const service = useRef(useInjection<INameService>(NameServiceId));

  const [name, setName] = useState('');

  const fetchName = () => {
    return service.current.fetchName();
  };

  useEffect(() => {
    const subscriptions: Subscription[] = [
      onEmit<string>(service.current.getName(), (value) => {
        setName(value);
      }),
    ];
    return () => {
      subscriptions.forEach((it) => it.unsubscribe());
    };
  }, []);

  return {name, fetchName};
};
```

Ok, there's a lot to unpack here. First, you might notice that we store the service instance in ref using `useRef` hook. Why is that? That's because if service isn't bound to a container as a singleton, on each `container.get()` call container will be creating a new instance of the service. This means, that if we don't store it as a ref, we'll be getting a completely new instance of NameService on each render, with empty string `_name` value. Singletons, obviously, aren't affected by this, since only one instance is created and then reused on all consecutive `container.get()` calls. Next, what's exactly going on in `useEffect`? What happens is basically once component mounts we subscribe to any `_name` updates. Once a new value is fired a callback is invoked, which in our current case will update the state of a component on which this facade hook is called. This way, once we trigger an update on all `_name` observers using `_name.next(value)`, the state of this component will be updated with the new value. We obviously delete the subscription once a component unmounts. We also bind the `fetchName` method by wrapping it with an arrow function to avoid any scoping issues. This is why we do:

```
const fetchName = () => {
    return service.current.fetchName();
};
...
return {name, fetchName};
```

Instead of simply:

```
// Don't do this
return {name, fetchName: service.current.fetchName};
```

And here's what our `Hello` component will end up looking like if we use this facade.

```
export const Hello: React.FC = () => {
    const {name, fetchName} = useNameProvider();

		useEffect(() => {
			fetchName();
		}, []);

    return (
        <h1>Hello {name}!</h1>
    );
};
```

And there you have it. A clean, simple and easy-to-read implementation of a component that is actually using a powerful dependency injection setup under the hood. The business logic is separated from the view. Make sure to read part 2 ✌️ (once it's ready), where I go through a real-life example of using this pattern.

### Caveats

- Boilerplate – As you've probably already noticed, this approach requires writing a lot of very explicit, boilerplate code. When it comes to productivity and code analysis tools, we, JS/TS developers are at a relative disadvantage. C# developers, for example, have incredibly powerful tools such as Visual Studio and ReSharper, that make managing very verbose and complex code easy. We have nothing that comes even close. Perhaps creating custom emmet autocompletions could help alleviate this problem.
- Decorators are still an experimental syntax – Hopefully, one day it'll be included in the standard. But what if it'll be rejected? Of course, it won't be the end of the world, but project maintenance would become much more difficult. It's already pretty tricky to set up an unorthodox bundler configuration and make `@babel/plugin-proposal-decorators` work correctly. If the proposal would be rejected, it would be getting harder and harder to set up projects with decorators using newer technologies.
- Hard to grasp by newbies – many React Native developers have web background, and many web developers, even senior level, are often not very familiar with OOP and SOLID.
- Seriously, it's hard to grasp by newbies – RxJS is a huge library, that requires a very thorough study of its concepts before it could be used. What is a pipe operator? What's the difference between subject and behavior subject? You either know the meaning of these terms or you don't.
- I'm going to repeat myself, but I think it's very important to stress this out: don't use this approach on the web unless you absolutely have to.

### Closing remarks

As I've mentioned before, RxJS isn't necessary to make this work. Let's get back to our first example. We could refactor service method `fetchName` to return the new name value:

```
public async fetchName () {
	return fetchNameFromAPI()
}
```

And then, we could refactor the `fetchName` function inside the `useNameProvider` facade to set the state like this:

```
const useNameProvider = () => {
  const service = useRef(useInjection<INameService>(NameServiceId));

  const [name, setName] = useState('');

  const fetchName = async () => {
		const newName = service.current.fetchName();
    setName(newName);
};

  return {name, fetchName};
};
```

And then, if you need something more sophisticated and flexible, the `onEmit`+`Subscription` setup could also be replaced with an array of callbacks stored inside the service.

And that's pretty much all there's to it. Stay tuned for 🚀part 2🚀 where I'll go over the real-life use of this pattern. I sincerely hope you found this post useful. If you ever decide to try this approach in your projects, please let me know how did it work out for you! And again, if you have any thoughts or questions feel free to contact me as well.
As always, thanks for reading! 🥳

---

Meta Description:
Dependency Injection in React Native using Typescript + Inversify + RxJS + SOLID
